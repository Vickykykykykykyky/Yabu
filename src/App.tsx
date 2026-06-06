import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavSidebar } from './components/nav/NavSidebar'
import { IconLogo } from './components/nav/NavIcons'
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
import { pickImageFile, pickImageFiles } from './utils/file'
import { compressImageFile, compressImageToBlob } from './utils/image'
import { ExploreView } from './views/ExploreView'
import { MessagesView } from './views/MessagesView'
import { NotificationsView } from './views/NotificationsView'
import { ProfileView } from './views/ProfileView'
import { ReelsView } from './views/ReelsView'
import { SearchView } from './views/SearchView'
import { AuthPage } from './views/AuthPage'
import { ChangePasswordPage } from './views/ChangePasswordPage'
import { OAuthProfileSetupPage } from './views/OAuthProfileSetupPage'
import { CollectionView } from './views/CollectionView'
import './App.css'

const VIEW_TITLES: Record<NavView, string> = {
  home: '首页',
  reels: '短视频',
  messages: '消息',
  search: '搜索',
  explore: '发现',
  notifications: '通知',
  profile: '个人主页',
  likes: '点赞',
  favorites: '收藏',
}

export default function App() {
  const auth = useAuth()
  const [activeView, setActiveView] = useState<NavView>(() => {
    const hash = window.location.hash.replace('#', '')
    const valid: NavView[] = ['home', 'reels', 'messages', 'search', 'explore', 'notifications', 'profile', 'likes', 'favorites']
    return valid.includes(hash as NavView) ? (hash as NavView) : 'home'
  })

  useEffect(() => {
    window.location.hash = activeView
  }, [activeView])

  useEffect(() => {
    const onPop = () => {
      const hash = window.location.hash.replace('#', '')
      const valid: NavView[] = ['home', 'reels', 'messages', 'search', 'explore', 'notifications', 'profile', 'likes', 'favorites']
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

  if (auth.needsProfileSetup) {
    return (
      <OAuthProfileSetupPage
        onSubmit={async (name) => {
          await auth.finishOAuthProfile(name)
        }}
        onLogout={auth.logout}
      />
    )
  }

  if (!auth.session) {
    return (
      <AuthPage
        onLogin={async (name, password) => {
          await auth.login(name, password)
        }}
        onLoginByEmail={async (email, password) => {
          await auth.loginByEmail(email, password)
        }}
        onSendEmailOtp={isSupabaseEnabled() ? auth.sendEmailOtp : undefined}
        onVerifyEmailOtp={
          isSupabaseEnabled()
            ? async (email, token) => {
                await auth.verifyEmailOtp(email, token)
              }
            : undefined
        }
        onSendEmailRegisterOtp={isSupabaseEnabled() ? auth.sendEmailRegisterOtp : undefined}
        onVerifyEmailRegisterOtp={
          isSupabaseEnabled()
            ? async (email, token, displayName) => {
                await auth.verifyEmailRegisterOtp(email, token, displayName)
              }
            : undefined
        }
        onRegister={async (name, password) => {
          await auth.register(name, password)
        }}
        onWeChatLogin={isSupabaseEnabled() ? auth.loginWeChat : undefined}
        onGoogleLogin={isSupabaseEnabled() ? auth.loginGoogle : undefined}
      />
    )
  }

  if (auth.session.mustChangePassword) {
    return (
      <ChangePasswordPage
        displayName={auth.session.displayName}
        onSubmit={async (current, next) => {
          await auth.updatePassword(current, next)
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
      onLinkEmail={auth.linkEmail}
      onWeChatLogin={isSupabaseEnabled() ? auth.loginWeChat : undefined}
      activeView={activeView}
      setActiveView={setActiveView}
    />
  )
}

type AuthenticatedProps = {
  profileId: string
  displayName: string
  onLogout: () => void | Promise<void>
  onLinkEmail: (email: string, password: string) => Promise<void>
  onWeChatLogin?: () => Promise<void>
  activeView: NavView
  setActiveView: (view: NavView) => void
}

function AuthenticatedApp({
  profileId,
  displayName,
  onLogout,
  onLinkEmail,
  onWeChatLogin,
  activeView,
  setActiveView,
}: AuthenticatedProps) {
  const {
    users,
    activeUser,
    currentUserId,
    unreadCount,
    updateUser,
    addPost,
    removePhoto,
    removePost,
    updatePhotoCaption,
    toggleLike,
    toggleFavorite,
    markNotificationsRead,
    refetchUnreadCount,
    persistWarning,
    r2Enabled,
    r2Ready,
    usersLoading,
    refetchUsers,
  } = useAppState(profileId)

  const shuffledUsers = useMemo(() => {
    const arr = [...users].filter((u) => u.photos.length > 0)
    const seed = arr.map(u => u.id).sort().join('|')
    let h = 0
    for (let i = 0; i < seed.length; i++) { h = ((h << 5) - h) + seed.charCodeAt(i); h |= 0 }
    const rand = () => { h = (h * 1103515245 + 12345) | 0; return (h >>> 0) / 0x100000000 }
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
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
    const file = await pickImageFile()
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

    setPreviewItems(
      files.map((file) => ({
        dataUrl: URL.createObjectURL(file),
        caption: '',
        file,
      })),
    )
  }, [])

  const handleUploadConfirm = useCallback(
    async (title: string, items: PreviewItem[]) => {
      setPreviewItems(null)

      try {
        const urls: { url: string; caption?: string }[] = []

        for (const item of items) {
          const file = (item as any).file as File | undefined
          const blob = file ?? await (await fetch(item.dataUrl)).blob()

          let url: string
          if (r2Enabled) {
            if (!r2Ready) { window.alert('R2 API 未就绪'); return }
            const meta = await uploadUserPhoto(currentUserId, blob)
            url = meta.url
          } else if (isSupabaseEnabled()) {
            url = await uploadPhotoToSupabase(currentUserId, blob)
          } else {
            url = await new Promise<string>(resolve => {
              const r = new FileReader()
              r.onload = () => resolve(r.result as string)
              r.readAsDataURL(blob as Blob)
            })
          }
          urls.push({ url, caption: item.caption || undefined })
        }

        if (urls.length > 0) {
          await addPost(currentUserId, urls, title)
          await refetchUsers()
        }
      } catch (err) {
        const message = isSupabaseEnabled()
          ? formatSupabaseError(err)
          : err instanceof Error
            ? err.message
            : '上传失败'
        window.alert(message)
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

  // 删除一组作品：批量走 RPC，不再逐张遍历
  const handleDeletePost = useCallback(async (post: { id: string; photos: { id: string; url: string }[] }) => {
    if (!currentUserId) return
    const photoIds = post.photos.map((p) => p.id)
    const photoUrls = post.photos.map((p) => p.url)
    await removePost(currentUserId, post.id, photoIds, photoUrls)
  }, [currentUserId, removePost])

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
          <div className="app__header-title">
            <IconLogo className="app__header-logo" />
            <h1 className="app__logo">{pageTitle}</h1>
          </div>
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
              <HomeFeed users={shuffledUsers} currentUserId={currentUserId} onViewPhoto={handleViewPhoto} onSelectUser={selectUser} onToggleLike={toggleLike} onToggleFavorite={toggleFavorite} />
            )
          )}

          {activeView === 'reels' && <ReelsView users={users} />}
          {activeView === 'messages' && (
            <MessagesView
              users={users}
              currentUserId={currentUserId}
            />
          )}
          {activeView === 'search' && (
            <SearchView users={users} onSelectUser={selectUser} />
          )}
          {activeView === 'explore' && (
            <ExploreView users={users} onSelectUser={selectUser} />
          )}
          {activeView === 'notifications' && (
            <NotificationsView currentUserId={currentUserId} users={users} onMarkRead={markNotificationsRead} onRefetchUnread={refetchUnreadCount} />
          )}
          {activeView === 'likes' && (
            <CollectionView type="likes" userId={currentUserId} users={users} onViewPost={handleOpenPost} />
          )}
          {activeView === 'favorites' && (
            <CollectionView type="favorites" userId={currentUserId} users={users} onViewPost={handleOpenPost} />
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
                onToggleLike={toggleLike}
                onToggleFavorite={toggleFavorite}
                onLogout={isOwn ? () => void onLogout() : undefined}
                onLinkEmail={isOwn ? onLinkEmail : undefined}
                onWeChatLogin={isOwn ? onWeChatLogin : undefined}
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
