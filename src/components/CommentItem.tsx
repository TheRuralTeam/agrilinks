// components/CommentItem.tsx
import { MessageSquare, ThumbsUp, User } from "lucide-react"
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"
import "dayjs/locale/pt"

dayjs.extend(relativeTime)
dayjs.locale("pt")

type CommentItemProps = {
  user_name: string
  user_type: string
  comment_text: string
  created_at: string
}

export function CommentItem({
  user_name,
  user_type,
  comment_text,
  created_at,
}: CommentItemProps) {
  return (
    <div className="flex gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all duration-150">
      
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">
        {user_name?.substring(0, 1).toUpperCase() || <User />}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-800">{user_name}</span>
          <span
            className="text-xs px-2 py-0.5 rounded-full bg-green-200 text-green-800 capitalize"
          >
            {user_type}
          </span>
        </div>

        <p className="text-sm text-gray-700 leading-relaxed">
          {comment_text}
        </p>

        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>{dayjs(created_at).fromNow()}</span>

          <button className="flex items-center gap-1 hover:text-green-600 transition">
            <ThumbsUp size={14} /> Gostar
          </button>

          <button className="flex items-center gap-1 hover:text-green-600 transition">
            <MessageSquare size={14} /> Responder
          </button>
        </div>
      </div>
    </div>
  )
}
