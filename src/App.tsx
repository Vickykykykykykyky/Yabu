import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavSidebar } from './components/nav/NavSidebar'
import { UploadButton } from './components/UploadButton'
import { UploadPreview } from './components/UploadPreview'
import type { PreviewItem } from './components/UploadPreview'
import { PhotoViewer } from './components/PhotoViewer'
import { HomeFeed } from './views/HomeFeed'
import { useAppState } from './hooks/useAppState'
import { useAuth } from './hooks/useAuth'
import type { NavView } from './types'
import { uploadUserPhoto } from './lib/r2-api'
import { isSupabaseEnabled } from './lib/supabase'
import { uploadAvatarToSupabase, uploadPhotoToSupabase } from './lib/supabase-storage'
import { formatSupabaseError } from './lib/supabase-errors'
import { pickImageFiles } from './utils/file'
import { compressImageFile, compressImageToBlob } from './utils/image'
import { ExploreView } from './views/ExploreView'
import { MessagesView } from './views/MessagesView'
import { NotificationsView } from './views/NotificationsView'
import { ProfileView } from './views/ProfileView'
import { ReelsView } from './views/ReelsView'
import { SearchView } from './views/SearchView'
import { AuthPage } from './views/AuthPage'
import './App.css'

const VIEW_TITLES: Record<NavView, string> = {
  home: '首页',
  reels: '短视频',
  messages: '消息',
  search: '搜索',
  explore: '发现',
  notifications: '通知',
  profile: '个人主页',
}

export default function App() {
  const auth = useAuth()
  const [activeView, setActiveView] = useState<NavView>(() => {
    const hash = window.location.hash.replace('#', '')
    const valid: NavView[] = ['home', 'reels', 'messages', 'search', 'explore', 'notifications', 'profile']
    return valid.includes(hash as NavView) ? (hash as NavView) : 'home'
  })

  useEffect(() => {
    window.location.hash = activeView
  }, [activeView])

  useEffect(() => {
    const onPop = () => {
      const hash = window.location.hash.replace('#', '')
      const valid: NavView[] = ['home', 'reels', 'messages', 'search', 'explore', 'notifications', 'profile']
      if (valid.includes(hash as NavView)) {
        setActiveView(hash as NavView)
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  if (auth.booting) {
    return (
      <div className="app app--auth-loading">
        <p>加载中…</p>
      </div>
    )
  }

  if (!auth.session) {
    return (
      <AuthPage
        onLogin={async (name) => {
          await auth.login(name)
        }}
        onRegister={async (name) => {
          await auth.register(name)
        }}
      />
    )
  }

  return (
    <AuthenticatedApp
      key={auth.session.profileId}
      profileId={auth.session.profileId}
      displayName={auth.session.displayName}
      onLogout={auth.logout}
      activeView={activeView}
      setActiveView={setActiveView}
    />
  )
}

type AuthenticatedProps = {
  profileId: string
  displayName: string
  onLogout: () => void
  activeView: NavView
  setActiveView: (view: NavView) => void
}

function AuthenticatedApp({
  profileId,
  displayName,
  onLogout,
  activeView,
  setActiveView,
}: AuthenticatedProps) {
  const {
    users,
    activeUser,
    currentUserId,
    messages,
    notifications,
    unreadCount,
    updateUser,
    addPost,
    removePhoto,
    updatePhotoCaption,
    sendMessage,
    markNotificationsRead,
    persistWarning,
    r2Enabled,
    r2Ready,
    usersLoading,
    refetchUsers,
  } = useAppState(profileId)

  const shuffledUsers = useMemo(() => {
    const arr = [...users]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }, [users])

  const [previewItems, setPreviewItems] = useState<PreviewItem[] | null>(null)
  const [viewingUserId, setViewingUserId] = useState<string | null>(null)
  const [viewerData, setViewerData] = useState<{
    urls: string[]
    captions: (string | undefined)[]
    photoIds: string[]
    index: number
    isOwn: boolean
    postTitle?: string
  } | null>(null)

  const handleAvatarPick = useCallback(async () => {
    const files = await pickImageFiles()
    const file = files[0]
    if (!file) return
    try {
      if (r2Enabled && r2Ready) {
        const blob = await compressImageToBlob(file)
        const meta = await uploadUserPhoto(currentUserId, blob)
        updateUser(currentUserId, { avatarUrl: meta.url })
      } else if (isSupabaseEnabled()) {
        const blob = await compressImageToBlob(file)
        const url = await uploadAvatarToSupabase(currentUserId, blob)
        updateUser(currentUserId, { avatarUrl: url })
      } else {
        const dataUrl = await compressImageFile(file)
        updateUser(currentUserId, { avatarUrl: dataUrl })
      }
    } catch (err) {
      window.alert(
        isSupabaseEnabled() ? formatSupabaseError(err) : err instanceof Error
          ? err.message
          : '头像处理失败，请换一张图片试试',
      )
    }
  }, [currentUserId, r2Enabled, r2Ready, updateUser])

  const handleUpload = useCallback(async () => {
    const files = await pickImageFiles()
    if (files.length === 0) return

    const items = await Promise.all(
      files.map((f) => compressImageFile(f)),
    )

    setPreviewItems(items.map((dataUrl) => ({ dataUrl, caption: '' })))
  }, [])

  const handleUploadConfirm = useCallback(
    async (title: string, items: PreviewItem[]) => {
      setPreviewItems(null)

      try {
        const uploaded: { url: string; caption?: string }[] = []
        for (const item of items) {
          if (r2Enabled) {
            if (!r2Ready) {
              window.alert('R2 API 未就绪，请先运行：npm run dev:api')
              return
            }
            const blob = await (await fetch(item.dataUrl)).blob()
            const meta = await uploadUserPhoto(currentUserId, blob)
            uploaded.push({ url: meta.url, caption: item.caption })
          } else if (isSupabaseEnabled()) {
            const blob = await (await fetch(item.dataUrl)).blob()
            const url = await uploadPhotoToSupabase(currentUserId, blob)
            uploaded.push({ url, caption: item.caption })
          } else {
            uploaded.push({ url: item.dataUrl, caption: item.caption })
          }
        }

        await addPost(currentUserId, uploaded, title)
        refetchUsers()
      } catch (err) {
        window.alert(
          isSupabaseEnabled() && !r2Enabled ? formatSupabaseError(err) : err instanceof Error
            ? err.message
            : '上传失败',
        )
      }
    },
    [currentUserId, addPost, r2Enabled, r2Ready, refetchUsers],
  )

  const handleUploadCancel = useCallback(() => {
    setPreviewItems(null)
  }, [])

  const handleViewPhoto = useCallback(
    (photos: string[], captions: (string | undefined)[], index: number, photoIds?: string[], isOwn?: boolean) => {
      setViewerData({ urls: photos, captions, photoIds: photoIds ?? [], index, isOwn: isOwn ?? false })
    },
    [],
  )

  const handleOpenPost = useCallback((post: { photos: { id: string; url: string; caption?: string }[]; title?: string }) => {
    setViewerData({
      urls: post.photos.map((p) => p.url),
      captions: post.photos.map((p) => p.caption),
      photoIds: post.photos.map((p) => p.id),
      index: 0,
      isOwn: true,
      postTitle: post.title,
    })
  }, [])

  const handleDeletePost = useCallback(async (post: { photos: { id: string }[] }) => {
    for (const ph of post.photos) {
      await removePhoto(currentUserId, ph.id)
    }
  }, [currentUserId, removePhoto])

  const handleNavigate = useCallback((view: NavView) => {
    if (view === 'profile') setViewingUserId(null)
    setActiveView(view)
  }, [setActiveView])

  const pageTitle =
    activeView === 'profile' ? activeUser.displayName : VIEW_TITLES[activeView]

  const selectUser = useCallback(
    (id: string) => {
      setViewingUserId(id === currentUserId ? null : id)
      setActiveView('profile')
    },
    [currentUserId, setActiveView],
  )

  return (
    <div className="app">
      <NavSidebar
        activeView={activeView}
        onNavigate={handleNavigate}
        onCreate={handleUpload}
        activeUser={activeUser}
        unreadCount={unreadCount}
        onMarkNotificationsRead={markNotificationsRead}
        onLogout={onLogout}
      />

      <main className={`app__main ${activeView === 'home' ? 'app__main--home' : ''}`}>
        <header className="app__header">
          <h1 className="app__logo">{pageTitle}</h1>
          {activeView === 'home' && (
            <p className="app__subtitle">
              你好，{displayName} · 点击右侧 + 上传到你的照片墙
            </p>
          )}
        </header>

        <div
          className={`app__content ${activeView === 'home' ? 'app__content--home' : ''}`}
        >
          {activeView === 'home' && (
            usersLoading ? (
              <p className="app__loading-users">加载照片墙…</p>
            ) : users.length === 0 ? (
              <p className="app__empty-users">
                还没有其他用户，点击 + 上传你的第一张照片吧
              </p>
            ) : (
              <HomeFeed users={shuffledUsers} currentUserId={currentUserId} onViewPhoto={handleViewPhoto} onSelectUser={selectUser} />
            )
          )}

          {activeView === 'reels' && <ReelsView users={users} />}
          {activeView === 'messages' && (
            <MessagesView
              users={users}
              activeUser={activeUser}
              messages={messages}
              onSendMessage={sendMessage}
            />
          )}
          {activeView === 'search' && (
            <SearchView users={users} onSelectUser={selectUser} />
          )}
          {activeView === 'explore' && (
            <ExploreView users={users} onSelectUser={selectUser} />
          )}
          {activeView === 'notifications' && (
            <NotificationsView notifications={notifications} />
          )}
          {activeView === 'profile' && (() => {
            const isOwn = !viewingUserId || viewingUserId === currentUserId
            const profileUser = isOwn ? activeUser : (users.find(u => u.id === viewingUserId) ?? activeUser)
            return (
              <ProfileView
                user={profileUser}
                onAvatarPick={isOwn ? handleAvatarPick : undefined}
                onOpenPost={isOwn ? handleOpenPost : (p) => handleViewPhoto(p.photos.map(ph => ph.url), p.photos.map(ph => ph.caption), 0, p.photos.map(ph => ph.id), false)}
                onDeletePost={isOwn ? handleDeletePost : undefined}
                onOpenPhoto={isOwn
                  ? (photo) => handleViewPhoto([photo.url], [photo.caption], 0, [photo.id], true)
                  : (photo) => handleViewPhoto([photo.url], [photo.caption], 0, [photo.id], false)}
                onDeletePhoto={isOwn ? ((photoId: string) => removePhoto(currentUserId, photoId)) : undefined}
                onUpdateCaption={isOwn ? ((photoId: string, caption: string) => updatePhotoCaption(currentUserId, photoId, caption)) : undefined}
                onUpdateName={isOwn ? ((id: string, name: string) => updateUser(id, { displayName: name })) : undefined}
                onLogout={isOwn ? onLogout : undefined}
              />
            )
          })()}
        </div>
      </main>

      <UploadButton onClick={handleUpload} />

      {previewItems && (
        <UploadPreview
          items={previewItems}
          onConfirm={handleUploadConfirm}
          onCancel={handleUploadCancel}
        />
      )}

      {viewerData && (
        <PhotoViewer
          urls={viewerData.urls}
          captions={viewerData.captions}
          photoIds={viewerData.photoIds}
          startIndex={viewerData.index}
          isOwn={viewerData.isOwn}
          postTitle={viewerData.postTitle}
          onClose={() => setViewerData(null)}
          onUpdateCaption={
            viewerData.isOwn
              ? (photoId, caption) => updatePhotoCaption(currentUserId, photoId, caption)
              : undefined
          }
          onDeletePhoto={
            viewerData.isOwn
              ? (photoId) => removePhoto(currentUserId, photoId)
              : undefined
          }
        />
      )}

      {persistWarning && (
        <p className="app__persist-warning" role="status">
          {persistWarning}
        </p>
      )}
    </div>
  )
}
