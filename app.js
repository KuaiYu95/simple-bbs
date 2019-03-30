const express = require('express')
const moment = require('moment')
// const sqlite3 = require('sqlite3').verbose()
// sqlite 将 sqlite3 封装成了 promise
// 可以对回调进行优化
const sqlite = require('sqlite')
const cookieParser = require('cookie-parser')
const logger = require('morgan')
const app = express()
const port = 8088


var db
console.log('opening database...')
sqlite.open(__dirname + '/bbs.sqlite3').then(val => {
	console.log('database open success')
	db = val
	console.log('starting web server...')
	app.listen(port, () => {
		console.log('Sever listening on port', port)
	})
})

/*
sqlite3 改为 sqlite
const db = new sqlite3.Database(__dirname + '/bbs.sqlite3', () => {
	console.log('database open success')
	console.log('starting web server...')
	app.listen(port, () => {
		console.log('Sever listening on port', port)
	})
})
*/

const comments = []	// 评论

const posts = [{	// 帖子
	id: 1,
	owner: 42,
	title: 'hello',
	content: 'world',
	timestamp: Date.now() - 156132123123
}, {
	id: 2,
	owner: 41,
	title: 'the quick',
	content: 'brown fox jumps over the lazy dog',
	timestamp: Date.now() - 4515312313
}, {
	id: 3,
	owner: 40,
	title: 'lorem',
	content: 'ipsum',
	timestamp: Date.now() - 4561231
}]

app.locals.pretty = true
app.set('view engine', 'pug')//设置使用的模板引擎
// app.set('views', __dirname + '/templates')//设置模板文件的文件夹

// app.engine('hbs', require('hbs').__express)

app.use(logger('dev'))
app.use(express.json())
app.use(express.urlencoded({
	extended: true	// 开启解析扩展url编码的功能foo[bar]=a&[foobaz]=b
}))
app.use(cookieParser('cookie signer'))


/*---------------------------
	      获取用户信息	
---------------------------*/
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
	/* 将回调改为try/catch
	if (req.signedCookies.loginUser) {
		db.get('SELECT * FROM users WHERE name=?', req.signedCookies.loginUser, (err, user) => {
			if (err) {
				next(err)
			} else {
				req.user = user
				next()
			}
		})
	} else {
		next()
	}
	*/
})

/*---------------------------
	      首页	
---------------------------*/
app.get('/', async(req, res, next) => {
	res.render('index.pug', {
		user: req.user,
		posts: posts,
		moment: moment,
	})
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
		/*
		if (req.user) { // 由用户登陆才能发
			var thread = req.body
			var lastThread = posts[posts.length - 1]
			thread.timestamp = Date.now()
			thread.owner = req.user.id
			thread.id = lastThread.id + 1
			posts.push(thread)
			res.redirect('/post/' + thread.id)
		} else {
			res.send('未登录！')
		}
		*/
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
		console.log(post)
		res.render('post.pug', {
			post : post,
			user : req.user,
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
	.post(async(req, res, next) => {
		try {
			await db.run('INSERT INTO users (name, password) VALUES (?,?)', req.body.name, req.body.password)	// 用户注册信息载人数据库
			res.cookie('loginUser', req.body.name, {
				signed : true	
			})
			res.render('register-result.pug', {
				user : req.body,
				status: 'REGISTER_SUCCESS'
			})
		} catch(e) {
			console.log(e)
			res.render('register-result.pug', {
				status: 'USERNAME_USED'
			})
		}
		/* 回调改为try/catch
		db.run('INSERT INTO users (name, password) VALUES (?,?)', req.body.name, req.body.password, (err) => {	// 用户注册信息载人数据库
			if (err) {	// 用户名已存在，注册失败
				res.render('register-result.pug', {
					status: 'USERNAME_USED'
				})
			} else {	// 新用户注册成功
				res.cookie('loginUser', req.body.name, {
					signed : true	
				})
				res.render('register-result.pug', {
					user : req.body,
					status: 'REGISTER_SUCCESS'
				})
			}
		})
		*/
	})

/*---------------------------
	      登录界面	
---------------------------*/
app.route('/login')	
	.get(async(req, res, next) => {
		res.render('login.pug')
	})
	.post(async(req, res, next) => {
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


		// db.get('SELECT * FROM users WHERE name=? AND password=?', req.body.name, req.body.password, (err, user) => {
		// 	if(err) {	// 查询出错
		// 		next(err)
		// 	} else {	// 查的过程中没有出错，能查到数据
		// 		if (user) {   // 从数据库中查到用户名及对应密码
		// 			res.cookie('loginUser', user.name, {
		// 				signed: true,
		// 				expires: new Date(Date.now() + 86400000)
		// 			})
		// 			res.redirect('/')
		// 		} else {	// 未匹配到用户
		// 			res.send('用户名或密码错误！')
		// 		}
		// 	}
		// })
	})

app.get('/logout', async(req, res, next) => {
	res.clearCookie('loginUser')
	res.redirect('/')
})

// app.listen(port,()=> {
// 	console.log('Server listening in port', port)
// })