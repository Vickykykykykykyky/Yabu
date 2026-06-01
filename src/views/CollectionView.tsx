import { useEffect, useState } from 'react'
import type { Post, UserProfile } from '../types'
import { fetchLikedPostIds, fetchFavoritedPostIds } from '../lib/supabase-profiles'
import { isSupabaseEnabled } from '../lib/supabase'
import './MediaViews.css'

type Props = {
  type: 'likes' | 'favorites'
  userId: string
  users: UserProfile[]
  onViewPost: (post: Post) => void
}

export function CollectionView({ type, userId, users, onViewPost }: Props) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      if (isSupabaseEnabled()) {
        try {
          const ids = type === 'likes'
            ? await fetchLikedPostIds(userId)
            : await fetchFavoritedPostIds(userId)
          const found: Post[] = []
          for (const u of users) {
            for (const p of u.posts ?? []) {
              if (ids.includes(p.id)) found.push(p)
            }
          }
          setPosts(found)
        } catch { setPosts([]) }
      } else {
        setPosts([])
      }
      setLoading(false)
    })()
  }, [type, userId, users])

  const title = type === 'likes' ? '我的点赞' : '我的收藏'
  const empty = type === 'likes' ? '还没有点赞过作品' : '还没有收藏过作品'

  if (loading) return <div className="media-view--empty"><p>加载中...</p></div>

  return (
    <div className="collection-view">
      <h2 className="collection-view__title">
        {title}
        <span className="collection-view__count">{posts.length}</span>
      </h2>

      {posts.length === 0 ? (
        <div className="media-view--empty">
          <p>{empty}</p>
        </div>
      ) : (
        <div className="profile-view__grid">
          {posts.map(post => {
            const cover = post.photos[0]
            return (
              <div key={post.id} className="profile-view__card">
                <div
                  className={`profile-view__card-img ${post.photos.length === 1 ? 'profile-view__card-img--single' : ''}`}
                  onClick={() => onViewPost(post)}
                  role="button"
                  tabIndex={0}
                >
                  {post.photos.length > 1 ? (
                    <div className="profile-view__post-stack">
                      <div className="profile-view__post-stack-cards">
                        <img src={post.photos[0].url} alt="" />
                        <img src={post.photos[1].url} alt="" />
                        {post.photos.length > 2 && <img src={post.photos[2].url} alt="" />}
                      </div>
                    </div>
                  ) : (
                    <img src={cover.url} alt="" />
                  )}
                  {post.title && <span className="profile-view__thumb-title">{post.title}</span>}
                  {post.photos.length > 1 && <span className="profile-view__thumb-count">{post.photos.length}</span>}
                </div>
                <div className="profile-view__card-body">
                  {post.title && <div className="profile-view__card-title">{post.title}</div>}
                  {cover.caption && <div className="profile-view__card-caption">{cover.caption}</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
