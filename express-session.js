
module.exports = function session(options) {

	var sessions = Object.create(null)

	return (req, res, next) => {
		if (req.cookies.sessionId) {
			var session = sessions[req.cookies.sessionId]
			if (session) {
				req.session =  session
			} else {
				req.session = sessions[req.cookies.sessionId] = {}
			}
		} else {
			var sessionId = Math.random().toString(16).slice(2)
			res.cookie('sessionId', sessionId, {
				maxAge: 86400000 * 365
			})
			req.session = sessions[sessionId] = {}
		}
		next()
	}
}