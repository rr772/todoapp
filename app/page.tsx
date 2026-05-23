"use client";

import { useState, useEffect, useRef } from "react";

type Task = {
  id: string;
  text: string;
  done: boolean;
  urgent: boolean;
  important: boolean;
  createdAt: number;
};

type Filter = "all" | "active" | "important" | "urgent" | "done";

const TABS: { key: Filter; label: string }[] = [
  { key: "all",       label: "すべて"   },
  { key: "active",    label: "未完了"   },
  { key: "important", label: "⭐重要"   },
  { key: "urgent",    label: "🏃急ぎ"   },
  { key: "done",      label: "完了済み" },
];

const TOAST_MS = 2000;

export default function Home() {
  const [tasks, setTasks]               = useState<Task[]>([]);
  const [input, setInput]               = useState("");
  const [filter, setFilter]             = useState<Filter>("all");
  const [mounted, setMounted]           = useState(false);
  const [justCompleted, setJustCompleted]   = useState<Set<string>>(new Set());
  const [completingIds, setCompletingIds]   = useState<Set<string>>(new Set());
  const [toast, setToast]                   = useState<{ text: string; id: string } | null>(null);
  const [dragOverId, setDragOverId]     = useState<string | null>(null);
  const dragId                          = useRef<string | null>(null);
  const toastTimer                      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef                        = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("todo-tasks");
    if (saved) setTasks(JSON.parse(saved));
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) localStorage.setItem("todo-tasks", JSON.stringify(tasks));
  }, [tasks, mounted]);

  const addTask = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setTasks((prev) => [
      { id: crypto.randomUUID(), text: trimmed, done: false,
        urgent: filter === "urgent", important: filter === "important", createdAt: Date.now() },
      ...prev,
    ]);
    setInput("");
    inputRef.current?.focus();
  };

  const toggleTask = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, done: !t.done } : t));

    if (task && !task.done) {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setCompletingIds((prev) => new Set([...prev, id]));
      setTimeout(() => setCompletingIds((prev) => { const s = new Set(prev); s.delete(id); return s; }), 500);
      setJustCompleted((prev) => new Set([...prev, id]));
      setToast({ text: task.text, id });
      toastTimer.current = setTimeout(() => {
        setJustCompleted((prev) => { const s = new Set(prev); s.delete(id); return s; });
        setToast(null);
      }, TOAST_MS);
    }
  };

  const undoComplete = () => {
    if (!toast) return;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setTasks((prev) => prev.map((t) => t.id === toast.id ? { ...t, done: false } : t));
    setJustCompleted((prev) => { const s = new Set(prev); s.delete(toast.id); return s; });
    setToast(null);
  };

  const toggleTag = (id: string, tag: "urgent" | "important") =>
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, [tag]: !t[tag] } : t));

  const deleteTask = (id: string) =>
    setTasks((prev) => prev.filter((t) => t.id !== id));

  /* Drag & Drop */
  const onDragStart = (id: string) => { dragId.current = id; };
  const onDragEnd   = () => { dragId.current = null; setDragOverId(null); };
  const onDragOver  = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (id !== dragId.current) setDragOverId(id);
  };
  const onDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverId(null);
    if (!dragId.current || dragId.current === targetId) return;
    setTasks((prev) => {
      const next = [...prev];
      const from = next.findIndex((t) => t.id === dragId.current);
      const to   = next.findIndex((t) => t.id === targetId);
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const filtered = tasks
    .filter((t) => {
      if (filter === "active")    return !t.done || justCompleted.has(t.id);
      if (filter === "done")      return t.done;
      if (filter === "important") return t.important && (!t.done || justCompleted.has(t.id));
      if (filter === "urgent")    return t.urgent && (!t.done || justCompleted.has(t.id));
      return true;
    })
    .sort((a, b) => {
      const aBottom = a.done && !justCompleted.has(a.id);
      const bBottom = b.done && !justCompleted.has(b.id);
      return Number(aBottom) - Number(bBottom);
    });

  const activeCount = tasks.filter((t) => !t.done).length;

  return (
    <main className="min-h-screen flex items-start justify-center pt-16 pb-16 px-4">

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-800 text-white text-sm px-4 py-3 rounded-2xl shadow-xl animate-fade-in whitespace-nowrap">
          <span className="max-w-[200px] overflow-hidden text-ellipsis">
            「{toast.text}」を完了しました
          </span>
          <button
            onClick={undoComplete}
            className="px-2.5 py-1 rounded-lg text-xs border border-white/25 bg-white/10 hover:bg-white/25 transition-colors"
          >
            元に戻す
          </button>
        </div>
      )}

      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">RyutaのToDo</h1>
          <p className="text-sm text-gray-400 mt-1">
            {activeCount === 0 ? "すべて完了しました 🎉" : `${activeCount}件の未完了タスク`}
          </p>
        </div>

        {/* Input */}
        <div className="flex gap-2 mb-6">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder="タスクを入力..."
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 transition"
          />
          <button
            onClick={addTask}
            disabled={!input.trim()}
            className="px-5 py-3 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            追加
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-4 bg-gray-200 p-1 rounded-xl">
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                filter === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Task list */}
        <div className="space-y-2">
          {!mounted ? null : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-300 text-sm select-none">タスクがありません</div>
          ) : (
            filtered.map((task) => (
              <div
                key={task.id}
                draggable
                onDragStart={() => onDragStart(task.id)}
                onDragEnd={onDragEnd}
                onDragOver={(e) => onDragOver(e, task.id)}
                onDragLeave={() => setDragOverId(null)}
                onDrop={(e) => onDrop(e, task.id)}
                className={`flex items-center gap-2 px-3 py-3 bg-white rounded-xl border-2 transition-all group ${
                  dragOverId === task.id ? "border-gray-500" : "border-transparent"
                }`}
              >
                {/* Drag handle */}
                <div className="cursor-grab active:cursor-grabbing text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
                    <circle cx="3" cy="2.5"  r="1.2"/><circle cx="7" cy="2.5"  r="1.2"/>
                    <circle cx="3" cy="7"    r="1.2"/><circle cx="7" cy="7"    r="1.2"/>
                    <circle cx="3" cy="11.5" r="1.2"/><circle cx="7" cy="11.5" r="1.2"/>
                  </svg>
                </div>

                {/* Checkbox */}
                <button
                  onClick={() => toggleTask(task.id)}
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    task.done ? "bg-gray-900 border-gray-900" : "border-gray-300 hover:border-gray-500"
                  } ${completingIds.has(task.id) ? "check-completing" : ""}`}
                  aria-label={task.done ? "未完了に戻す" : "完了にする"}
                >
                  {task.done && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 5l2.5 2.5 4.5-4.5" />
                    </svg>
                  )}
                </button>

                {/* Text */}
                <span className={`flex-1 text-sm leading-relaxed transition-all ${task.done ? "text-gray-300 line-through" : "text-gray-800"}`}>
                  {task.text}
                </span>

                {/* Tags */}
                <div className="flex gap-1 flex-shrink-0">
                  {(["urgent", "important"] as const).map((tag) => (
                    <button key={tag} onClick={() => toggleTag(task.id, tag)}
                      className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all ${
                        task[tag]
                          ? tag === "urgent" ? "opacity-100 bg-orange-50" : "opacity-100 bg-yellow-50"
                          : "opacity-25 hover:opacity-60"
                      }`}
                    >
                      {tag === "urgent" ? "🏃" : "⭐"}
                    </button>
                  ))}
                </div>

                {/* Delete */}
                <button
                  onClick={() => deleteTask(task.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-400 transition-all rounded-lg hover:bg-red-50"
                  aria-label="削除"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {tasks.length > 0 && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setTasks((prev) => prev.filter((t) => !t.done))}
              className="text-xs text-gray-400 hover:text-red-400 transition-colors"
            >
              完了済みを削除
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
