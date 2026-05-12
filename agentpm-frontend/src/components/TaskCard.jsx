import { useDraggable } from '@dnd-kit/core';

const priorityColors = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

export default function TaskCard({ task, onClick }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 100,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // only open modal on click (not drag)
        if (!isDragging) onClick?.(task);
      }}
      className={`group bg-white rounded-lg border border-gray-200 p-3 mb-2 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing transition-shadow ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-2 gap-2">
        <h4 className="text-sm font-medium text-gray-900 leading-snug flex-1">
          {task.title}
        </h4>
        <div className="flex items-center gap-1 shrink-0">
          {task.storyPoints != null && (
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
              {task.storyPoints}
            </span>
          )}
          {/* Edit button — stops drag so pointer events don't initiate a drag */}
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onClick?.(task); }}
            className="p-1 rounded hover:bg-indigo-50 text-gray-300 hover:text-indigo-500 transition opacity-0 group-hover:opacity-100"
            title="Modifier"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>
      </div>

      {task.description && (
        <p className="text-xs text-gray-500 mb-2 line-clamp-2" style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {task.description}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 mt-2">
        <span className={`text-xs px-2 py-0.5 rounded-full ${priorityColors[task.priority] || priorityColors.medium}`}>
          {task.priority}
        </span>

        <div className="flex items-center gap-2 text-xs text-gray-400">
          {task.commentCount > 0 && (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {task.commentCount}
            </span>
          )}

          {task.assigneeName && (
            <span
              className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-semibold flex items-center justify-center"
              title={task.assigneeName}
            >
              {task.assigneeName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
