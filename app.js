const express = require('express')
const moment = require('moment')
// const sqlite3 = require('sqlite3').verbose()
// sqlite 将 sqlite3 封装成了 promise
// 可以对回调进行优化
// express 只解析了请求头，没有解析请求体

const sqlite = require('sqlite')
const session = require('./express-session')
const cookieParser = require('cookie-parser')
const svgCaptcha = require('svg-captcha')
const logger = require('morgan')
const multer = require('multer')
const upload = multer({dest: __dirname + '/avatars'})
const app = express()
const port = 8088

var db
sqlite.open(__dirname + '/bbs.sqlite3').then(val => {
	db = val
	app.listen(port, () => {
		console.log('Sever listening on port', port)
	})
})

app.locals.pretty = true
app.set('view engine', 'pug')//设置使用的模板引擎
// app.set('views', __dirname + '/templates')//设置模板文件的文件夹

// app.engine('hbs', require('hbs').__express)

app.use(logger('dev'))
app.use('/static', express.static(__dirname + '/public'))
app.use('/avatars', express.static(__dirname + '/avatars'))

app.use(express.json())	// 解析content-Type为json的编码
app.use(express.urlencoded({	// 解析content-Type为url的编码
	extended: true	// 开启解析扩展url编码的功能foo[bar]=a&[foobaz]=b
}))
app.use(cookieParser('cookie signer'))

/*---------------------------
		添加sessionID及
		sessionData中间件	
---------------------------*/
app.use(session())

/*---------------------------
	      获取用户信息	
---------------------------*/
//从cookie中查询出当前登陆用户并放在req对象的user属性上
app.use(async(req, res, next) => {
	if (req.signedCookies.loginUser) {
		try {
			req.user = await db.get('SELECT * FROM users WHERE name=?', req.signedCookies.loginUser)
		} catch(e) {
			next(e)
			return
		}
	}
	next()
})

/*---------------------------
	      首页	
---------------------------*/
app.get('/', async(req, res, next) => {
	try {
		var posts = await db.all(`
			SELECT id, userId as ownerId, title, content, name as ownerName, timestamp 
			FROM posts JOIN users 
			ON posts.owner = ownerId`)
		res.render('index.pug', {
			user: req.user,
			posts: posts,
			moment: moment,
		})
	} catch(e) {
		next(e)
	}
})

/*---------------------------
	      用户界面	
---------------------------*/
app.get('/user/:id', async(req, res, next) => {
	var user = await db.get('SELECT * FROM users WHERE userId=?', req.params.id)
	res.render('user.pug', {user})
})

/*---------------------------
	      发帖界面	
---------------------------*/
app.route('/add-post')
	.get(async(req, res, next) => {
		res.render('add-post.pug', {user : req.user})
	})
	.post(async(req, res, next) => {
		if (req.user) {
			try {
				await db.run('INSERT INTO posts (title, content, owner, timestamp) VALUES (?,?,?,?)', 
					req.body.title, req.body.content, req.user.userId, Date.now())
				var post = await db.get('SELECT * FROM posts ORDER BY id DESC LIMIT 1')
				res.redirect('/post/' + post.id)
			} catch(e) {
				next(e)
				return
			}
		} else {
			res.send('未登录！')
		}
	})

/*---------------------------
	      删帖	
---------------------------*/
app.delete('/post/:id', async(req, res, next) => {
	var post = await db.get('SELECT * FROM posts WHERE id=?', req.params.id)
	if (req.user && req.user.userId === post.owner) {
		try{
			await Promise.all([
				db.run('DELETE FROM posts WHERE id=?', req.params.id),
				db.run('DELETE FROM comments WHERE postId=?', req.params.id)
			])
			res.json({
				code: 0,
				msg: 'ok',
			})
		} catch(e) {
			next(e)
		}
	} else {
		res.status(401).json({
			code: -1,
			msg: 'Not Login or Unauthorized'
		})
	}
})

/*---------------------------
	      看帖界面	
---------------------------*/
app.get('/post/:id', async(req, res, next) => {
	try {
		var post = await db.get(`
			SELECT id, userId as ownerId, title, content, name as ownerName, timestamp
			FROM posts JOIN users 
			ON posts.owner = ownerId 
			WHERE id=?`, req.params.id)
		// console.log(post)
		var comments = await db.all(`
			SELECT name AS ownerName, * FROM comments JOIN users ON ownerId=userId WHERE postId=?`, req.params.id)

		res.render('post.pug', {
			post : post,
			user : req.user,
			comments : comments,
			moment : moment
		})
	} catch(e) {
		next(e)
	}
})

/*---------------------------
	      添加评论	
---------------------------*/
app.post('/add-comment', async(req, res, next) => {
	if (req.user) {
		try {
			await db.run('INSERT INTO comments (content,postId,ownerId,timestamp) VALUES (?,?,?,?)', 
				req.body.content, req.body.postId, req.user.userId, Date.now())
			// res.redirect('/post/' + req.body.postId)
			var comment = await db.get(`
				SELECT commentId, content, postId, ownerId, timestamp, userId, name as ownerName
				FROM comments JOIN users 
				ON ownerId = userId
				ORDER BY commentId DESC LIMIT 1`)
			console.log(comment)
			res.json({
				code: 0,
				msg: 'ok',
				data: {comment: comment,}
			})
		} catch(e) {
			next(e)
		}
	} else {
		res.send('未登录！')
	}
})

/*---------------------------
	      删除评论	
---------------------------*/
app.delete('/comment/:id', async(req, res, next) => {
	try{
		await db.run('DELETE FROM comments WHERE commentId=?', req.params.id)
		res.json({
			code:0,
			msg:'ok',
		})
	} catch(e) {
		next(e)
	}
})

/*---------------------------
	      注册界面	
---------------------------*/
app.route('/register')
	.get(async(req, res, next) => {
		res.render('register.pug')
	})
	.post(upload.single('avatar'), async(req, res, next) => {
		try {
			await db.run(`INSERT INTO users (name, password, email, avatar) VALUES (?,?,?,?)`, 
				req.body.name, req.body.password, req.body.email, req.file.filename)	// 用户注册信息载人数据库
			res.cookie('loginUser', req.body.name, {
				signed : true	
			})
			res.render('register-result.pug', {
				user : req.body,
				status: 'REGISTER_SUCCESS'
			})
		} catch(e) {
			res.render('register-result.pug', {
				status: 'USERNAME_USED'
			})
		}
	})

/*---------------------------
	      登录界面	
---------------------------*/
app.route('/login')	
	.get(async(req, res, next) => {
		res.render('login.pug')
	})
	.post(async(req, res, next) => {
		console.log(req.body.captcha, req.session.captcha)
		if (req.body.captcha !== req.session.captcha) {
			res.send('验证码不正确！')
			return
		}
		try {
			var user = await db.get('SELECT * FROM users WHERE name=? AND password=?', req.body.name, req.body.password)
			if (user) {   // 从数据库中查到用户名及对应密码
				res.cookie('loginUser', user.name, {
					signed: true,
					expires: new Date(Date.now() + 86400000)
				})
				res.redirect('/')
			} else {	// 未匹配到用户
				res.send('用户名或密码错误！')
			}
		} catch(e) {
			next(e)
		}
	})

/*---------------------------
	      获取验证码	
---------------------------*/
app.get('/captcha.svg', (req, res, next) => {
	var captcha = svgCaptcha.create()
	req.session.captcha = captcha.text.toLowerCase()
	res.type('svg')
	res.send(captcha.data)
	res.end()
})

/*---------------------------
	      登出界面	
---------------------------*/
app.get('/logout', async(req, res, next) => {
	res.clearCookie('loginUser')
	res.redirect('/')
})