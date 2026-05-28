const express = require('express');

const app = express();
app.use(express.json());

let todos = [];
let nextId = 1;

// 获取所有事项（支持 ?q= 搜索）
app.get('/api/todos', (req, res) => {
  const { q } = req.query;
  const result = q ? todos.filter(t => t.text.includes(q)) : todos;
  res.json(result);
});

// 获取单个事项
app.get('/api/todos/:id', (req, res) => {
  const todo = todos.find(t => t.id === Number(req.params.id));
  todo ? res.json(todo) : res.status(404).json({ error: 'Not found' });
});

// 新增事项
app.post('/api/todos', (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }
  const todo = { id: nextId++, text: text.trim(), done: false };
  todos.unshift(todo);
  res.status(201).json(todo);
});

// 更新事项
app.put('/api/todos/:id', (req, res) => {
  const todo = todos.find(t => t.id === Number(req.params.id));
  if (!todo) return res.status(404).json({ error: 'Not found' });
  const { text, done } = req.body;
  if (text !== undefined) todo.text = text.trim();
  if (done !== undefined) todo.done = Boolean(done);
  res.json(todo);
});

// 删除事项
app.delete('/api/todos/:id', (req, res) => {
  const idx = todos.findIndex(t => t.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  todos.splice(idx, 1);
  res.status(204).send();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
