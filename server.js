const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.static('public', { index: 'todo.html' }));

const DATA_FILE = path.join(__dirname, 'data.json');
const TODO_PASSWORD = process.env.TODO_PASSWORD || 'admin123';

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

let todos = readData();
let nextId = todos.length ? Math.max(...todos.map(t => t.id)) + 1 : 1;

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = header.slice(7);
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    if (decoded !== TODO_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// 登录接口 —— 不拦截
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (!password || password !== TODO_PASSWORD) {
    return res.status(401).json({ error: '密码错误' });
  }
  const token = Buffer.from(password).toString('base64');
  res.json({ token });
});

// 以下 /api/todos 路由需要认证
app.use('/api/todos', authMiddleware);

// 获取所有事项（支持 ?q= & ?tag= & ?overdue=true）
app.get('/api/todos', (req, res) => {
  let result = [...todos];
  const { q, tag, overdue } = req.query;
  if (q) result = result.filter(t => t.text.includes(q));
  if (tag) result = result.filter(t => t.tag === tag);
  if (overdue === 'true') {
    const today = new Date().toISOString().slice(0, 10);
    result = result.filter(t => t.dueDate && t.dueDate < today && !t.done);
  }
  // 按截止日期排序：有日期在前（越近越前），无日期在后
  result.sort((a, b) => {
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    return 0;
  });
  res.json(result);
});

// 获取标签列表
app.get('/api/tags', authMiddleware, (req, res) => {
  const tags = [...new Set(todos.map(t => t.tag).filter(Boolean))];
  res.json(tags);
});

// 获取单个事项
app.get('/api/todos/:id', (req, res) => {
  const todo = todos.find(t => t.id === Number(req.params.id));
  todo ? res.json(todo) : res.status(404).json({ error: 'Not found' });
});

// 新增事项
app.post('/api/todos', (req, res) => {
  const { text, tag, dueDate } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }
  const todo = {
    id: nextId++,
    text: text.trim(),
    done: false,
    tag: tag || '其他',
    dueDate: dueDate || null
  };
  todos.unshift(todo);
  writeData(todos);
  res.status(201).json(todo);
});

// 更新事项
app.put('/api/todos/:id', (req, res) => {
  const todo = todos.find(t => t.id === Number(req.params.id));
  if (!todo) return res.status(404).json({ error: 'Not found' });
  const { text, done, tag, dueDate } = req.body;
  if (text !== undefined) todo.text = text.trim();
  if (done !== undefined) todo.done = Boolean(done);
  if (tag !== undefined) todo.tag = tag;
  if (dueDate !== undefined) todo.dueDate = dueDate || null;
  writeData(todos);
  res.json(todo);
});

// 删除事项
app.delete('/api/todos/:id', (req, res) => {
  const idx = todos.findIndex(t => t.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  todos.splice(idx, 1);
  writeData(todos);
  res.status(204).send();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
