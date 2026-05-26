import { useCallback, useState } from 'react'
import { NavSidebar } from './components/nav/NavSidebar'
import { UploadButton } from './components/UploadButton'
import { UserColumn } from './components/UserColumn'
import { useAppState } from './hooks/useAppState'
import type { NavView } from './types'
import { uploadUserPhoto } from './lib/r2-api'
import { isSupabaseEnabled } from './lib/supabase'
import { uploadAvatarToSupabase, uploadPhotoToSupabase } from './lib/supabase-storage'
import { pickImageFile } from './utils/file'
import { compressImageFile, compressImageToBlob } from './utils/image'
import { ExploreView } from './views/ExploreView'
import { MessagesView } from './views/MessagesView'
import { NotificationsView } from './views/NotificationsView'
import { ProfileView } from './views/ProfileView'
import { ReelsView } from './views/ReelsView'
import { SearchView } from './views/SearchView'
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
  const [activeView, setActiveView] = useState<NavView>('home')
  const {
    users,
    activeUser,
    activeUserId,
    messages,
    notifications,
    unreadCount,
    setActiveUserId,
    updateUser,
    addPhoto,
    sendMessage,
    markNotificationsRead,
    persistWarning,
    r2Enabled,
    r2Ready,
  } = useAppState()

  const handleAvatarPick = useCallback(async () => {
    try {
      const file = await pickImageFile()
      if (!file) return
      if (r2Enabled && r2Ready) {
        const blob = await compressImageToBlob(file)
        const meta = await uploadUserPhoto(activeUserId, blob)
        updateUser(activeUserId, { avatarUrl: meta.url })
      } else if (isSupabaseEnabled()) {
        const blob = await compressImageToBlob(file)
        const url = await uploadAvatarToSupabase(activeUserId, blob)
        updateUser(activeUserId, { avatarUrl: url })
      } else {
        const dataUrl = await compressImageFile(file)
        updateUser(activeUserId, { avatarUrl: dataUrl })
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '头像处理失败，请换一张图片试试')
    }
  }, [activeUserId, r2Enabled, r2Ready, updateUser])

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
        const meta = await uploadUserPhoto(activeUserId, blob)
        addPhoto(activeUserId, meta.url)
      } else if (isSupabaseEnabled()) {
        const blob = await compressImageToBlob(file)
        const url = await uploadPhotoToSupabase(activeUserId, blob)
        addPhoto(activeUserId, url)
      } else {
        const dataUrl = await compressImageFile(file)
        addPhoto(activeUserId, dataUrl)
      }

      setActiveView('home')
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '上传失败')
    }
  }, [activeUserId, addPhoto, r2Enabled, r2Ready])

  const selectUser = useCallback(
    (id: string) => {
      setActiveUserId(id)
      setActiveView('home')
    },
    [setActiveUserId],
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
          <h1 className="app__logo">{VIEW_TITLES[activeView]}</h1>
          {activeView === 'home' && (
            <p className="app__subtitle">点击用户栏切换当前用户</p>
          )}
        </header>

        <div className={`app__content ${activeView === 'home' ? 'app__content--home' : ''}`}>
          {activeView === 'home' && (
            <section className="app__columns" aria-label="用户照片墙">
              {users.map((user) => (
                <UserColumn
                  key={user.id}
                  user={user}
                  isActive={user.id === activeUserId}
                  onSelect={() => setActiveUserId(user.id)}
                />
              ))}
            </section>
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
              onUpdate={(patch) => updateUser(activeUserId, patch)}
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
