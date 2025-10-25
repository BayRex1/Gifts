const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'telegram-gifts-secret-key-render';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

// Middleware для логирования
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Файлы для хранения данных
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const LEADERS_FILE = path.join(DATA_DIR, 'leaders.json');

// Инициализация данных
function initializeDataFiles() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    if (!fs.existsSync(USERS_FILE)) {
        fs.writeFileSync(USERS_FILE, JSON.stringify([]));
    }
    
    if (!fs.existsSync(LEADERS_FILE)) {
        fs.writeFileSync(LEADERS_FILE, JSON.stringify([]));
    }
}

function readUsers() {
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

function readLeaders() {
    try {
        const data = fs.readFileSync(LEADERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

function writeUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function writeLeaders(leaders) {
    fs.writeFileSync(LEADERS_FILE, JSON.stringify(leaders, null, 2));
}

// Данные кейсов
const casesData = {
    daily: {
        name: "Ежедневный кейс",
        price: 0,
        image: "/images/cases/daily-case.png",
        items: [
            { id: 1, name: "Mighty Arm", image: "/images/items/mighty-arm.png", value: 10 },
            { id: 2, name: "Desk Calendar", image: "/images/items/desk-calendar.png", value: 15 },
            { id: 3, name: "Flying Broom", image: "/images/items/flying-broom.png", value: 20 }
        ]
    },
    bomj: {
        name: "Бомжик",
        price: 0,
        image: "/images/cases/bomj-case.png",
        items: [
            { id: 4, name: "Сердечко", image: "/images/items/heart.png", value: 5 },
            { id: 5, name: "Мишка", image: "/images/items/bear.png", value: 8 },
            { id: 6, name: "Роза", image: "/images/items/rose.png", value: 12 },
            { id: 7, name: "Ракета", image: "/images/items/rocket.png", value: 18 },
            { id: 8, name: "Цветы", image: "/images/items/flowers.png", value: 15 },
            { id: 9, name: "Алмаз", image: "/images/items/diamond.png", value: 25 }
        ]
    },
    durov: {
        name: "Durov Case",
        price: 100,
        image: "/images/cases/durov-case.png",
        items: [
            { id: 10, name: "Plush Pepe (gold)", image: "/images/items/pepe.png", value: 50 },
            { id: 11, name: "Vintage Sigar", image: "/images/items/sigar.png", value: 40 },
            { id: 12, name: "Top Hat", image: "/images/items/hat.png", value: 35 },
            { id: 13, name: "Perfume Bottle", image: "/images/items/perfume.png", value: 45 }
        ]
    },
    bayrex: {
        name: "BayRex Case",
        price: 150,
        image: "/images/cases/bayrex-case.png",
        items: [
            { id: 14, name: "Plush Pepe (gold)", image: "/images/items/pepe.png", value: 50 },
            { id: 15, name: "Vintage Sigar", image: "/images/items/sigar.png", value: 40 },
            { id: 16, name: "Top Hat", image: "/images/items/hat.png", value: 35 },
            { id: 17, name: "Perfume Bottle", image: "/images/items/perfume.png", value: 45 }
        ]
    }
};

// Middleware аутентификации
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Неверный токен' });
        }
        req.user = user;
        next();
    });
}

// API Routes

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

app.get('/api/captcha', (req, res) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let captcha = '';
    for (let i = 0; i < 6; i++) {
        captcha += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    res.json({ captcha });
});

app.post('/api/register', async (req, res) => {
    const { email, username, password, captchaInput, captcha } = req.body;

    if (captchaInput !== captcha) {
        return res.status(400).json({ error: 'Неверная капча' });
    }

    if (!email || !username || !password) {
        return res.status(400).json({ error: 'Все поля обязательны' });
    }

    const users = readUsers();

    if (users.find(u => u.email === email)) {
        return res.status(400).json({ error: 'Email уже используется' });
    }

    if (users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Имя пользователя занято' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
        id: uuidv4(),
        email,
        username,
        password: hashedPassword,
        balance: 100,
        inventory: [],
        casesOpened: 0,
        avatar: null,
        registrationDate: new Date().toISOString(),
        isAdmin: username === 'BayRex'  // Исправлено: убрал @
    };

    users.push(newUser);
    writeUsers(users);
    updateLeaders(newUser);

    const token = jwt.sign(
        { id: newUser.id, username: newUser.username, isAdmin: newUser.isAdmin },
        JWT_SECRET,
        { expiresIn: '24h' }
    );

    res.json({
        token,
        user: {
            id: newUser.id,
            username: newUser.username,
            email: newUser.email,
            balance: newUser.balance,
            inventory: newUser.inventory,
            casesOpened: newUser.casesOpened,
            avatar: newUser.avatar,
            isAdmin: newUser.isAdmin
        }
    });
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    const users = readUsers();
    const user = users.find(u => u.email === email);

    if (!user) {
        return res.status(400).json({ error: 'Пользователь не найден' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
        return res.status(400).json({ error: 'Неверный пароль' });
    }

    const token = jwt.sign(
        { id: user.id, username: user.username, isAdmin: user.isAdmin },
        JWT_SECRET,
        { expiresIn: '24h' }
    );

    res.json({
        token,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            balance: user.balance,
            inventory: user.inventory,
            casesOpened: user.casesOpened,
            avatar: user.avatar,
            isAdmin: user.isAdmin
        }
    });
});

app.get('/api/user', authenticateToken, (req, res) => {
    const users = readUsers();
    const user = users.find(u => u.id === req.user.id);

    if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        balance: user.balance,
        inventory: user.inventory,
        casesOpened: user.casesOpened,
        avatar: user.avatar,
        isAdmin: user.isAdmin
    });
});

function updateLeaders(user) {
    let leaders = readLeaders();
    leaders = leaders.filter(l => l.id !== user.id);
    
    const bestItem = user.inventory.length > 0 ? 
        user.inventory.reduce((best, current) => 
            current.value > best.value ? current : best, user.inventory[0]) : 
        null;

    leaders.push({
        id: user.id,
        username: user.username,
        balance: user.balance,
        casesOpened: user.casesOpened,
        bestItem: bestItem ? bestItem.name : 'Нет предметов',
        bestItemValue: bestItem ? bestItem.value : 0
    });

    leaders.sort((a, b) => b.balance - a.balance);
    writeLeaders(leaders);
}

app.get('/api/leaders', (req, res) => {
    const leaders = readLeaders();
    res.json(leaders.slice(0, 50));
});

app.get('/api/cases', (req, res) => {
    res.json(casesData);
});

app.post('/api/open-case', authenticateToken, (req, res) => {
    const { caseType } = req.body;
    const caseData = casesData[caseType];

    if (!caseData) {
        return res.status(400).json({ error: 'Кейс не найден' });
    }

    const users = readUsers();
    const userIndex = users.findIndex(u => u.id === req.user.id);

    if (userIndex === -1) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const user = users[userIndex];

    if (caseData.price > 0 && user.balance < caseData.price) {
        return res.status(400).json({ error: 'Недостаточно звезд' });
    }

    if (caseData.price > 0) {
        user.balance -= caseData.price;
    }

    const randomIndex = Math.floor(Math.random() * caseData.items.length);
    const reward = { ...caseData.items[randomIndex], id: uuidv4() };

    user.inventory.push(reward);
    user.casesOpened++;

    users[userIndex] = user;
    writeUsers(users);
    updateLeaders(user);

    res.json({
        reward,
        newBalance: user.balance,
        casesOpened: user.casesOpened
    });
});

app.post('/api/sell-item', authenticateToken, (req, res) => {
    const { itemId } = req.body;

    const users = readUsers();
    const userIndex = users.findIndex(u => u.id === req.user.id);

    if (userIndex === -1) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const user = users[userIndex];
    const itemIndex = user.inventory.findIndex(item => item.id === itemId);

    if (itemIndex === -1) {
        return res.status(404).json({ error: 'Предмет не найден' });
    }

    const item = user.inventory[itemIndex];
    user.balance += item.value;
    user.inventory.splice(itemIndex, 1);

    users[userIndex] = user;
    writeUsers(users);
    updateLeaders(user);

    res.json({
        newBalance: user.balance,
        soldItem: item
    });
});

app.post('/api/change-avatar', authenticateToken, (req, res) => {
    const { avatarUrl } = req.body;

    const users = readUsers();
    const userIndex = users.findIndex(u => u.id === req.user.id);

    if (userIndex === -1) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }

    users[userIndex].avatar = avatarUrl;
    writeUsers(users);

    res.json({ avatar: avatarUrl });
});

app.post('/api/activate-promo', authenticateToken, (req, res) => {
    const { promoCode } = req.body;

    if (promoCode.toUpperCase() === 'TELEGRAM2023') {
        const users = readUsers();
        const userIndex = users.findIndex(u => u.id === req.user.id);

        if (userIndex === -1) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        users[userIndex].balance += 50;
        writeUsers(users);
        updateLeaders(users[userIndex]);

        res.json({
            success: true,
            message: 'Промокод активирован! +50 ★',
            newBalance: users[userIndex].balance
        });
    } else {
        res.status(400).json({ error: 'Неверный промокод' });
    }
});

// Ежедневный бонус
app.post('/api/daily-bonus', authenticateToken, (req, res) => {
    const users = readUsers();
    const userIndex = users.findIndex(u => u.id === req.user.id);
    
    if (userIndex === -1) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const user = users[userIndex];
    const now = new Date();
    const lastBonusDate = user.lastBonusDate ? new Date(user.lastBonusDate) : null;
    
    if (lastBonusDate && 
        lastBonusDate.getDate() === now.getDate() &&
        lastBonusDate.getMonth() === now.getMonth() &&
        lastBonusDate.getFullYear() === now.getFullYear()) {
        return res.status(400).json({ error: 'Вы уже получали бонус сегодня' });
    }

    const bonusAmount = 25;
    user.balance += bonusAmount;
    user.lastBonusDate = now.toISOString();
    
    users[userIndex] = user;
    writeUsers(users);
    updateLeaders(user);

    res.json({
        success: true,
        bonus: bonusAmount,
        newBalance: user.balance,
        message: `Ежедневный бонус: +${bonusAmount} ★`
    });
});

// Система достижений
const achievements = {
    firstCase: { name: 'Первый шаг', description: 'Откройте первый кейс', reward: 10 },
    caseMaster: { name: 'Мастер кейсов', description: 'Откройте 10 кейсов', reward: 50 },
    rich: { name: 'Богач', description: 'Накопите 1000 звезд', reward: 100 },
    collector: { name: 'Коллекционер', description: 'Соберите 15 различных предметов', reward: 75 }
};

app.get('/api/achievements', authenticateToken, (req, res) => {
    const users = readUsers();
    const user = users.find(u => u.id === req.user.id);
    
    if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const userAchievements = user.achievements || [];
    const unlocked = [];
    
    if (user.casesOpened >= 1 && !userAchievements.includes('firstCase')) {
        unlocked.push('firstCase');
    }
    
    if (user.casesOpened >= 10 && !userAchievements.includes('caseMaster')) {
        unlocked.push('caseMaster');
    }
    
    if (user.balance >= 1000 && !userAchievements.includes('rich')) {
        unlocked.push('rich');
    }
    
    if (unlocked.length > 0) {
        user.achievements = user.achievements || [];
        unlocked.forEach(achievementId => {
            user.achievements.push(achievementId);
            user.balance += achievements[achievementId].reward;
        });
        
        writeUsers(users);
        updateLeaders(user);
    }

    res.json({
        achievements: Object.entries(achievements).map(([id, achievement]) => ({
            id,
            ...achievement,
            unlocked: userAchievements.includes(id)
        })),
        unlocked: unlocked.map(id => ({
            id,
            ...achievements[id]
        }))
    });
});

app.post('/api/admin/set-balance', authenticateToken, (req, res) => {
    const { targetUsername, newBalance } = req.body;

    if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const users = readUsers();
    const targetUserIndex = users.findIndex(u => u.username === targetUsername);

    if (targetUserIndex === -1) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }

    users[targetUserIndex].balance = parseInt(newBalance);
    writeUsers(users);
    updateLeaders(users[targetUserIndex]);

    res.json({
        success: true,
        message: `Баланс ${targetUsername} установлен на ${newBalance} ★`,
        user: {
            username: users[targetUserIndex].username,
            balance: users[targetUserIndex].balance
        }
    });
});

// Обслуживание клиента
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling
app.use((error, req, res, next) => {
    console.error('Error:', error);
    res.status(500).json({ 
        error: 'Внутренняя ошибка сервера',
        ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Маршрут не найден' });
});

// Инициализация и запуск
initializeDataFiles();

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📱 Откройте: http://localhost:${PORT}`);
});
