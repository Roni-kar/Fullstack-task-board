import React, { useState, useRef, useEffect } from "react";
import "./App.css";
// 1. IMPORT ANIMATION & CONFETTI
import { motion, AnimatePresence } from "framer-motion";
import Confetti from "react-confetti";

// --- YOUR PUBLIC KEY ---
const publicVapidKey = "BGiVewQ6FcFFwQArWDuUhi_7A1rjiKGCMvF5AHFm83fyTdIZ2eSbPsegndESPEj0ULwYgAvItepKgk7qRTrepdo";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function App() {
  const [taskInput, setTaskInput] = useState("");
  const [taskDate, setTaskDate] = useState("");
  const [subscription, setSubscription] = useState(null);
  
  // --- CONFETTI & TOAST STATE ---
  const [showConfetti, setShowConfetti] = useState(false);
  const [toast, setToast] = useState(null);
  const [windowDimension, setWindowDimension] = useState({ width: window.innerWidth, height: window.innerHeight });

  // --- DARK MODE STATE 🌙 ---
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });

  const toggleTheme = () => {
    setDarkMode(!darkMode);
  };

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark-mode");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.remove("dark-mode");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  useEffect(() => {
    const detectSize = () => setWindowDimension({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', detectSize);
    return () => window.removeEventListener('resize', detectSize);
  }, []);

  // --- NOTIFICATIONS ---
  useEffect(() => {
    async function registerAndSubscribe() {
      if ("serviceWorker" in navigator) {
        try {
          const register = await navigator.serviceWorker.register("/worker.js", { scope: "/" });
          const readyRegistration = await navigator.serviceWorker.ready;
          const sub = await readyRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
          });
          setSubscription(sub);
          await fetch("http://192.168.0.185:5000/subscribe", { // KEEP YOUR IP HERE
            method: "POST",
            body: JSON.stringify(sub),
            headers: { "content-type": "application/json" }
          });
        } catch (err) {
          console.error("Error connecting to notifications:", err);
        }
      }
    }
    registerAndSubscribe();
  }, []);

  // --- STATE ---
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem("my-task-board-pro");
    return saved ? JSON.parse(saved) : { todo: [], progress: [], completed: [] };
  });

  useEffect(() => {
    localStorage.setItem("my-task-board-pro", JSON.stringify(tasks));
  }, [tasks]);

  const triggerError = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // --- AUTO-MOVER ROBOT 🤖 ---
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      let hasChanges = false;
      const newTasks = { ...tasks };

      const checkAndMove = (columnName) => {
        const overdueTasks = newTasks[columnName].filter(t => t.dueDate && new Date(t.dueDate).getTime() <= now);
        if (overdueTasks.length > 0) {
          newTasks[columnName] = newTasks[columnName].filter(t => !t.dueDate || new Date(t.dueDate).getTime() > now);
          newTasks.completed = [...newTasks.completed, ...overdueTasks];
          hasChanges = true;
        }
      };

      checkAndMove("todo");
      checkAndMove("progress");

      if (hasChanges) setTasks({ ...newTasks });

    }, 5000); 

    return () => clearInterval(interval);
  }, [tasks]);

  // --- ADD TASK ---
  const addTask = async () => {
    if (!taskInput.trim()) return;
    const newTask = { id: Date.now(), text: taskInput, dueDate: taskDate };
    
    setTasks((prev) => ({ ...prev, todo: [...prev.todo, newTask] }));

    if (taskDate && subscription) {
      const dueTime = new Date(taskDate).getTime();
      const delay = dueTime - Date.now();
      if (delay > 0) {
        await fetch("http://192.168.0.185:5000/schedule", { // KEEP YOUR IP HERE
          method: "POST",
          body: JSON.stringify({ subscription, text: taskInput, delay }),
          headers: { "content-type": "application/json" }
        });
      }
    }
    setTaskInput("");
    setTaskDate("");
  };

  const handleKeyDown = (e) => { if (e.key === "Enter") addTask(); };

  // --- DRAG AND DROP ---
  const [dragOverCol, setDragOverCol] = useState(null);
  const dragItem = useRef();
  
  const handleDragStart = (e, column, index) => {
    dragItem.current = { column, index };
  };

  const handleDrop = (e, targetColumn) => {
    e.preventDefault();
    const currentItem = dragItem.current;
    if (!currentItem || currentItem.column === targetColumn) { setDragOverCol(null); return; }

    if (targetColumn === "progress" && tasks.progress.length >= 3) {
        triggerError("Finish something first! 🛑");
        setDragOverCol(null);
        return;
    }

    const sourceList = [...tasks[currentItem.column]];
    const itemToMove = sourceList[currentItem.index];
    sourceList.splice(currentItem.index, 1);
    
    const targetList = [...tasks[targetColumn]];
    targetList.push(itemToMove);

    setTasks((prev) => ({ ...prev, [currentItem.column]: sourceList, [targetColumn]: targetList }));
    
    if (targetColumn === "completed") {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4000);
    }

    setDragOverCol(null);
  };

  // --- EDIT & DELETE ---
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ col: null, index: null, text: "", dueDate: "" });

  const deleteTask = (col, idx) => {
    const newTasks = { ...tasks };
    newTasks[col].splice(idx, 1);
    setTasks(newTasks);
  };

  const startEdit = (col, idx) => {
    if (col === "todo") {
        if (tasks.progress.length >= 3) {
            triggerError("Progress is full! Editing in To-Do.");
            const task = tasks[col][idx];
            setEditData({ col, index: idx, text: task.text, dueDate: task.dueDate });
            setIsEditing(true);
        } else {
            const newTasks = { ...tasks };
            const [movedTask] = newTasks.todo.splice(idx, 1);
            newTasks.progress.push(movedTask);
            setTasks(newTasks);

            const newIndex = newTasks.progress.length - 1;
            setEditData({ col: "progress", index: newIndex, text: movedTask.text, dueDate: movedTask.dueDate });
            setIsEditing(true);
            triggerError("Moved to Progress 🚀");
        }
    } else {
        const task = tasks[col][idx];
        setEditData({ col, index: idx, text: task.text, dueDate: task.dueDate });
        setIsEditing(true);
    }
  };

  const saveEdit = () => {
    const newTasks = { ...tasks };
    newTasks[editData.col][editData.index] = { ...newTasks[editData.col][editData.index], text: editData.text, dueDate: editData.dueDate };
    setTasks(newTasks);
    setIsEditing(false);
  };

  const formatDateDisplay = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
  };

  return (
    <div className="app">
      {/* 🎉 CONFETTI */}
      {showConfetti && (
        <Confetti 
          width={windowDimension.width} height={windowDimension.height} 
          numberOfPieces={400} recycle={false}
          style={{ position: 'fixed', top: 0, left: 0, zIndex: 9999, pointerEvents: 'none' }}
        />
      )}

      {/* 🛑 TOAST MESSAGE */}
      <AnimatePresence>
        {toast && (
            <motion.div 
                className="toast-alert"
                initial={{ opacity: 0, y: -50, x: "-50%" }}
                animate={{ opacity: 1, y: 0, x: "-50%", rotate: [0, -5, 5, -5, 5, 0] }}
                exit={{ opacity: 0, y: -20, x: "-50%" }}
                transition={{ duration: 0.4 }}
            >
                {toast}
            </motion.div>
        )}
      </AnimatePresence>

      {/* EDIT MODAL */}
      {isEditing && (
        <div className="modal-overlay" onClick={() => setIsEditing(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Task</h3>
            <input value={editData.text} onChange={(e) => setEditData({ ...editData, text: e.target.value })} />
            <input type="datetime-local" value={editData.dueDate} onChange={(e) => setEditData({ ...editData, dueDate: e.target.value })} />
            <div className="modal-actions">
              <button className="cancel" onClick={() => setIsEditing(false)}>Cancel</button>
              <button className="save" onClick={saveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}

      <div className="board">
        <header>
          <h1>Task Board</h1>
          <button className="theme-toggle" onClick={toggleTheme}>
            {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
          </button>
        </header>

        <div className="add-task">
            <input value={taskInput} onChange={(e) => setTaskInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Add new task..." />
            <input type="datetime-local" className="date-input" value={taskDate} onChange={(e) => setTaskDate(e.target.value)} />
            <button onClick={addTask}>Add</button>
        </div>

        <div className="columns">
          {["todo", "progress", "completed"].map((col) => (
            <div 
              key={col} 
              className={`column ${dragOverCol === col ? "drag-over" : ""}`}
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={(e) => setDragOverCol(col)}
              onDrop={(e) => handleDrop(e, col)}
            >
              <h2>
                {col === "todo" ? "TO-DO" : 
                 col === "progress" ? `IN PROGRESS (${tasks.progress.length}/3)` : 
                 "COMPLETED"}
              </h2>
              
              <AnimatePresence>
                {tasks[col].map((task, index) => (
                  <motion.div 
                    key={task.id} 
                    className="task"
                    draggable 
                    onDragStart={(e) => handleDragStart(e, col, index)}
                    onDragEnd={(e) => { e.target.classList.remove("dragging"); dragItem.current = null; setDragOverCol(null); }}
                    layout 
                    initial={{ opacity: 0, y: 20, scale: 0.95 }} 
                    animate={{ opacity: 1, y: 0, scale: 1 }}    
                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }} 
                    transition={{ duration: 0.2 }}
                    whileHover={{ scale: 1.02, boxShadow: "0px 5px 10px rgba(0,0,0,0.1)" }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="task-content">
                      <span>{task.text}</span>
                      {task.dueDate && <small className="due-date-label">📅 {formatDateDisplay(task.dueDate)}</small>}
                    </div>

                    {/* --- THE FIXED BUTTONS --- */}
                    <div className="task-actions">
                      <motion.button 
                        className="icon-btn edit" 
                        onClick={() => startEdit(col, index)}
                        whileHover={{ scale: 1.2, backgroundColor: "#e0e0e0" }}
                        whileTap={{ scale: 0.9 }}
                      >
                        ✎
                      </motion.button>

                      <motion.button 
                        className="icon-btn delete" 
                        onClick={() => deleteTask(col, index)}
                        whileHover={{ scale: 1.2, backgroundColor: "#ffecec", color: "#d63031" }}
                        whileTap={{ scale: 0.9 }}
                      >
                        🗑
                      </motion.button>
                    </div>
                    
                  </motion.div>
                ))}
              </AnimatePresence>

            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;