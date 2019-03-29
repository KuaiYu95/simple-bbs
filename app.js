const express = require('express')
const moment = require('moment')
const cookieParser = require('cookie-parser')
const app = express()
const port = 8088

const users = [{	// 用户
	id: 42,
	name: 'a',
	password: 'a',
	// email: 'damiao@damiao.io'
}, {
	id: 41,
	name: 'zs',
	password: '1',
	// email: 'zs@zs.io'
}, {
	id: 40,
	name: 'ls',
	password: '12',
	// email: 'ls@sl.io'
}]

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

app.use(express.json())
app.use(express.urlencoded())
app.use(cookieParser('cookie signer'))

app.use((req, res, next) => {
	if (req.signedCookies.user) {
		req.user = users.find(it => it.name == req.signedCookies.user)
	}
	next()
})


app.get('/', (req, res, next) => {	// 首页
	res.render('index.pug', {
		user: req.user,
		posts: posts,
		moment: moment,
	})
})

app.route('/add-thread') // 发帖
	.get((req, res, next) => {
		res.render('add-thread.pug', {user : req.user})
	})
	.post((req, res, next) => {
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
	})

app.get('/post/:id', (req, res, next) => {	// 看帖
	var post = posts.find(it => it.id == req.params.id)
	res.render('post.pug', {
		post : post,
		user : req.user
	})
})

app.route('/register')	// 注册
	.get((req, res, next) => {
		res.render('register.pug')
	})
	.post((req, res, next) => {	
		if(users.find(it => it.name == req.body.name) == null) {
			var lastUser = users[users.length - 1]
			req.body.id = lastUser.id + 1
			users.push(req.body)
			res.cookie('user', req.body.name, {
				signed : true
			})
			res.render('register-result.pug', {
				user : req.body,
				status: 'REGISTER_SUCCESS'
			})
		} else {
			res.render('register-result.pug', {
				status: 'USERNAME_USED'
			})
		}
	})

app.route('/login')	// 登录
	.get((req, res, next) => {
		res.render('login.pug')
	})
	.post((req, res, next) => {	
		var user = users.find(it => it.name == req.body.name)
		if (user) {
			if (user.password == req.body.password) {
				res.cookie('user', user.name, {
					signed: true,
					expires: new Date(Date.now() + 86400000)
				})
				res.redirect('/')
			} else {
				res.send('密码错误！')
			}
		} else {
			res.send('用户不存在！')
		}
	})

app.get('/logout', (req, res, next) => {
	res.clearCookie('user')
	res.redirect('/')
})

app.listen(port,()=> {
	console.log('Server listening in port', port)
})