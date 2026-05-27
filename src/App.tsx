import { useCallback, useState } from 'react'
import { NavSidebar } from './components/nav/NavSidebar'
import { UploadButton } from './components/UploadButton'
import { HomeFeed } from './views/HomeFeed'
import { useAppState } from './hooks/useAppState'
import { useAuth } from './hooks/useAuth'
import type { NavView } from './types'
import { uploadUserPhoto } from './lib/r2-api'
import { isSupabaseEnabled } from './lib/supabase'
import { uploadAvatarToSupabase, uploadPhotoToSupabase } from './lib/supabase-storage'
import { formatSupabaseError } from './lib/supabase-errors'
import { pickImageFile } from './utils/file'
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
  const [activeView, setActiveView] = useState<NavView>('home')

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
    addPhoto,
    removePhoto,
    sendMessage,
    markNotificationsRead,
    persistWarning,
    r2Enabled,
    r2Ready,
    usersLoading,
  } = useAppState(profileId)

  const handleAvatarPick = useCallback(async () => {
    try {
      const file = await pickImageFile()
      if (!file) return
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
    try {
      const file = await pickImageFile()
      if (!file) return

      if (r2Enabled) {
        if (!r2Ready) {
          window.alert('R2 API 未就绪，请先运行：npm run dev:api')
          return
        }
        const blob = await compressImageToBlob(file)
        const meta = await uploadUserPhoto(currentUserId, blob)
        await addPhoto(currentUserId, meta.url)
      } else if (isSupabaseEnabled()) {
        const blob = await compressImageToBlob(file)
        const url = await uploadPhotoToSupabase(currentUserId, blob)
        await addPhoto(currentUserId, url)
      } else {
        const dataUrl = await compressImageFile(file)
        await addPhoto(currentUserId, dataUrl)
      }

      setActiveView('home')
    } catch (err) {
      window.alert(
        isSupabaseEnabled() && !r2Enabled ? formatSupabaseError(err) : err instanceof Error
          ? err.message
          : '上传失败',
      )
    }
  }, [currentUserId, addPhoto, r2Enabled, r2Ready, setActiveView])

  const handleDeletePhoto = useCallback(
    async (photoId: string) => {
      try {
        await removePhoto(currentUserId, photoId)
      } catch (err) {
        window.alert(
          isSupabaseEnabled() ? formatSupabaseError(err) : err instanceof Error
            ? err.message
            : '删除失败',
        )
      }
    },
    [currentUserId, removePhoto],
  )

  const pageTitle =
    activeView === 'profile' ? activeUser.displayName : VIEW_TITLES[activeView]

  const selectUser = useCallback(
    (id: string) => {
      if (id === currentUserId) setActiveView('profile')
      else setActiveView('home')
    },
    [currentUserId, setActiveView],
  )

  return (
    <div className="app">
      <NavSidebar
        activeView={activeView}
        onNavigate={setActiveView}
        onCreate={handleUpload}
        activeUser={activeUser}
        unreadCount={unreadCount}
        onMarkNotificationsRead={markNotificationsRead}
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
              <HomeFeed users={users} currentUserId={currentUserId} />
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
          {activeView === 'profile' && (
            <ProfileView
              user={activeUser}
              onAvatarPick={handleAvatarPick}
              onDeletePhoto={handleDeletePhoto}
              onLogout={onLogout}
            />
          )}
        </div>
      </main>

      <UploadButton onClick={handleUpload} />

      {persistWarning && (
        <p className="app__persist-warning" role="status">
          {persistWarning}
        </p>
      )}
    </div>
  )
}
