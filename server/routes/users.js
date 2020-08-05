require('./linkedDB');

let express = require('express');
let router = express.Router();
let Users = require('../models/users');
let PageView = require('../models/pageview');
let CheckTools = require('../utils/checkTools');
let AutoLogin_Global = false;

router.post('/login', function(req, res, next) {
    let param = {
        UserName: req.body.UserName,
        Password: req.body.Password
    }
    let AutoLogin = req.body.AutoLogin;
	AutoLogin_Global = req.body.AutoLogin;

	//Web安全，用户输入检查
	let UserNameCheckRes = CheckTools.UserNameRegExp.test(param.UserName),
		PasswordCheckRes = CheckTools.PasswordRegExp.test(param.Password);
	if(!UserNameCheckRes || !PasswordCheckRes){
		res.json({
			status: 1,
			msg: 'Invalid user name or password!'
		});
		return ;
	}

	//Web安全，同源检测
	let domainCheckRes = CheckTools.AllowDomainCheck(req.headers.origin, req.headers.referer);
	if(!domainCheckRes){
		res.json({
			status: 1,
			msg: 'origin response, cross domain illegal request!'
		});
		return ;
	}
	
    Users.findOne(param, function(err, doc){
        if(err){
			res.json({
				status: 1,
				msg: err.message
			});
			return ;
		}
		
		if(doc){
			// req.session.user = doc;使用session存储，需要express-session插件
			updateCookie(res, doc, AutoLogin);

			res.json({
				status: 0,
				msg: '',
				result: {
					NickName: doc.NickName
				}
			});
		}else{
			res.json({
				status: 1,
				msg: 'user does not exist!'
			});
		}
    });
});

router.post('/logout', function(req, res, next){
	//Web安全，同源检测
	let domainCheckRes = CheckTools.AllowDomainCheck(req.headers.origin, req.headers.referer);
	if(!domainCheckRes){
		res.json({
			status: 1,
			msg: 'origin response, cross domain illegal request!'
		});
		return ;
	}

	//Web安全，CSRF Token验证
	let bodyToken = req.body.ReqToken,
		cookieToken = req.cookies.sbux_token_lo;
	
	if(bodyToken === undefined || cookieToken === undefined || bodyToken !== cookieToken){
		res.json({
			status: 1,
			msg: 'token response, cross domain illegal request!'
		});
		return ;
	}

	res.cookie("UserID", "", {
		path: "/",
		maxAge: -1
	});

	res.cookie("NickName", "", {
		path: "/",
		maxAge: -1
	});

	res.json({
		status: 0,
		msg: ''
	})
});

router.post('/checkLogin', function(req, res, next){
	//Web安全，同源检测
	let domainCheckRes = CheckTools.AllowDomainCheck(req.headers.origin, req.headers.referer);
	if(!domainCheckRes){
		res.json({
			status: 1,
			msg: 'origin response, cross domain illegal request!'
		});
		return ;
	}

	//Web安全，CSRF Token验证
	let bodyToken = req.body.ReqToken,
		cookieToken = req.cookies.sbux_token_cl;
	
	if(bodyToken === undefined || cookieToken === undefined || bodyToken !== cookieToken){
		res.json({
			status: 1,
			msg: 'token response, cross domain illegal request!'
		});
		return ;
	}

	if(req.cookies.UserID){
		//用户活跃期间延长登录时间
		updateCookie(res, req.cookies, AutoLogin_Global);
		res.json({
			status: 0,
			msg: '',
			result: {
				NickName: req.cookies.NickName
			}
		});
	}else{
		res.json({
			status: 1,
			msg: '当前未登录',
			result: ''
		})
	}

});

router.post('/accountInfo', function(req, res, next) {
	//Web安全，同源检测
	let domainCheckRes = CheckTools.AllowDomainCheck(req.headers.origin, req.headers.referer);
	if(!domainCheckRes){
		res.json({
			status: 1,
			msg: 'origin response, cross domain illegal request!'
		});
		return ;
	}

	//Web安全，CSRF Token验证
	let bodyToken = req.body.ReqToken,
		cookieToken = req.cookies.sbux_token_gai;
	
	if(bodyToken === undefined || cookieToken === undefined || bodyToken !== cookieToken){
		res.json({
			status: 1,
			msg: 'token response, cross domain illegal request!'
		});
		return ;
	}
	
	let param = {
        UserID: req.cookies.UserID
	}

    Users.findOne(param, function(err, doc){
        if(err){
			res.json({
				status: 1,
				msg: err.message
			});
			return ;
		}
		
		if(doc){
			res.json({
				status: 0,
				msg: '',
				result: {
					MemberShip: doc.MemberShip,
					SvcCard: doc.SvcCard,
					MyRewards: doc.MyRewards,
					ExpensesRecord: doc.ExpensesRecord
				}
			});
		}else{
			res.json({
				status: 1,
				msg: 'user does not exist!'
			});
		}
    });
});

router.post('/checkExpireDate', function(req, res, next){
	//Web安全，同源检测
	let domainCheckRes = CheckTools.AllowDomainCheck(req.headers.origin, req.headers.referer);
	if(!domainCheckRes){
		res.json({
			status: 1,
			msg: 'origin response, cross domain illegal request!'
		});
		return ;
	}

	//Web安全，CSRF Token验证
	let bodyToken = req.body.ReqToken,
		cookieToken = req.cookies.sbux_token_ce;
	
	if(bodyToken === undefined || cookieToken === undefined || bodyToken !== cookieToken){
		res.json({
			status: 1,
			msg: 'token response, cross domain illegal request!'
		});
		return ;
	}
	
	let param = {
        UserID: req.cookies.UserID
    }

    Users.findOne(param, function(err, doc){
        if(err){
			res.json({
				status: 1,
				msg: err.message
			});
			return ;
		}
		
		if(doc){
			let MemberShipExpireDate = doc.MemberShip.ExpireDate,
				MyRewardsExpireDateArr = getMyRewardsExpireDate(doc);

			let obj = checkExpireDate(MemberShipExpireDate, MyRewardsExpireDateArr);
			let MSED = obj.MSED,
				MRED_Arr = obj.MRED_Arr;
			
			if(MSED != '' || MRED_Arr.length != 0){
				let state = updateExpireDate(MSED, MRED_Arr, req.cookies.UserID);
				
				if(state === 'complete'){
					res.json({
						status: 0,
						msg: '',
						result: {
							state: 'Update Complete',
						}
					});
				}
			}else{
				res.json({
					status: 0,
					msg: '',
					result: {
						state: 'Not Expired',
					}
				});
			}
		}else{
			res.json({
				status: 1,
				msg: 'user does not exist!'
			});
		}
    });
});

router.post("/pageview", (req, res, next)=>{
	//Web安全，同源检测
	let domainCheckRes = CheckTools.AllowDomainCheck(req.headers.origin, req.headers.referer);
	if(!domainCheckRes){
		res.json({
			status: 1,
			msg: 'origin response, cross domain illegal request!'
		});
		return ;
	}

	//Web安全，CSRF Token验证
	let bodyToken = req.body.ReqToken,
		cookieToken = req.cookies.sbux_token_pv;
	
	if(bodyToken === undefined || cookieToken === undefined || bodyToken !== cookieToken){
		res.json({
			status: 1,
			msg: 'token response, cross domain illegal request!'
		});
		return ;
	}

	PageView.update({
		UserType: 'Visitor'
	}, {
		$push: {
			VisitorInfo: {
				Location: req.body.location,
				Time: req.body.time,
				Device: req.body.device,
				Browser: req.body.browser,
				IP: getClientIp(req, 'nginx')
			}
		}
	}, (err, doc)=>{
		PageView.findOne({UserType: 'Visitor'}, (err, doc)=>{
			let pageviews = doc.PageViews;
			PageView.update({
				UserType: 'Visitor'
			}, {
				PageViews: ++pageviews
			}, (err, doc)=>{
				if(doc) {
					res.json({
						status: 0,
						msg: '',
						result: {
							PageViews: pageviews
						}
					})
				}
			})
		})
	})
});










function getClientIp(req, proxyType) {
	let ip = req.connection.remoteAddress || req.socket.remoteAddress || (req.connection.socket ? req.connection.socket.remoteAddress : null);
	// 如果使用了nginx代理
	if (proxyType === 'nginx') {
		// headers上的信息容易被伪造,但是我不care,自有办法过滤,例如'x-nginx-proxy'和'x-real-ip'我在nginx配置里做了一层拦截把他们设置成了'true'和真实ip,所以不用担心被伪造
		// 如果没用代理的话,我直接通过req.connection.remoteAddress获取到的也是真实ip,所以我不care
		ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || ip;
	}
	const ipArr = ip.split(',');
	// 如果使用了nginx代理,如果没配置'x-real-ip'只配置了'x-forwarded-for'为$proxy_add_x_forwarded_for,如果客户端也设置了'x-forwarded-for'进行伪造ip
	// 则req.headers['x-forwarded-for']的格式为ip1,ip2只有最后一个才是真实的ip
	if (proxyType === 'nginx') {
		ip = ipArr[ipArr.length - 1];
	}
	if (ip.indexOf('::ffff:') !== -1) {
		ip = ip.substring(7);
	}
	return ip;
}

function updateCookie(response, data, autoLogin){
	if(autoLogin){
		response.cookie("UserID", data.UserID, {
			path: '/',
			maxAge: 1000*60*60*24*3,
			httpOnly: true  //Web安全，防止xss后的cookie劫持
		});
		response.cookie("NickName", data.NickName, {
			path: '/',
			maxAge: 1000*60*60*24*3
		});
	}else{
		response.cookie("UserID", data.UserID, {
			path: '/',
			httpOnly: true  //Web安全，防止xss后的cookie劫持
		});
		response.cookie("NickName", data.NickName, {
			path: '/',
		});
	}
}

function getMyRewardsExpireDate(data){
	let MyRewards = data.MyRewards,
		MyRewardsExpireDateArr = [];

	for(let i = 0; i < MyRewards.length; i++){
		if(MyRewards[i].State === 'AVL'){
			let duplic = false;

			for(let j = 0; j < MyRewardsExpireDateArr.length; j++){
				if(MyRewardsExpireDateArr[j] === MyRewards[i].ExpireDate){
					duplic = true;
				}
			}

			if(!duplic){
				MyRewardsExpireDateArr.push(MyRewards[i].ExpireDate);
			}
			
		}
	}

	return MyRewardsExpireDateArr;
}

function checkExpireDate(MSED, MRED_Arr){
	let CurrentTime = new Date().getTime(),
		Offset = 1000*60*60*24;

	let MemberShipExpireDate = '',
		MyRewardsExpireDateArr = [];

	let MemberShipExpireTime = Date.parse(MSED);
	if(CurrentTime - MemberShipExpireTime > Offset){
		MemberShipExpireDate = MSED;
	}

	for(let i = 0; i < MRED_Arr.length; i++){
		let MyRewardsExpireTime = Date.parse(MRED_Arr[i]);
		if(CurrentTime - MyRewardsExpireTime > Offset){
			MyRewardsExpireDateArr.push(MRED_Arr[i]);
		}

	}

	let obj = {
		'MSED': MemberShipExpireDate,
		'MRED_Arr': MyRewardsExpireDateArr
	}

	return obj;
}

function updateExpireDate(MemberShipExpireDate, MyRewardsExpireDateArr, UserID){

	if(MemberShipExpireDate != ''){

		Users.update({"UserID":UserID, "MemberShip.ExpireDate": MemberShipExpireDate}, {
			"MemberShip.ExpireDate": getNewExpireDate(MemberShipExpireDate, 'month', 3),
		}, function(err, doc){
									
		});
	}

	if(MyRewardsExpireDateArr.length != 0){
		for(let i = 0; i < MyRewardsExpireDateArr.length; i++){
			function updateExec(){
				Users.update(
					//批量修改的方法无效，此处利用递归实现批量修改
					// {"$set": {"MyRewards.$.ExpireDate": getNewExpireDate(MyRewardsExpireDateArr[0],'days',16),"MyRewards.$.StartDate": getCurrentDate(),}}, 
					// {multi: true, overwrite: true},
					{"UserID": UserID, "MyRewards.ExpireDate": MyRewardsExpireDateArr[0]}, 
					{"MyRewards.$.StartDate": getCurrentDate(), "MyRewards.$.ExpireDate": getNewExpireDate(MyRewardsExpireDateArr[0],'days',14)},
					function(err, doc){
						if(doc.ok === 1){
							updateExec();
						}
					}
				);
			}
			updateExec();
		}
	}
	
	return 'complete';
}

function getCurrentDate(){
	let date = new Date(),
		year = date.getFullYear().toString(),
		month = date.getMonth() + 1,
		day = date.getDate();

	month = formatStyle(month);
	day = formatStyle(day);

	return year+'/'+month+'/'+day;
}

function getNewExpireDate(date, type, num){
	let dateArr = date.split('/'),
		year = parseInt(dateArr[0]),
		month = parseInt(dateArr[1]),
		day = dateArr[2];

	let aDayMillSec = 24*60*60*1000,
		baseMillSec = Date.parse(date) + aDayMillSec,
		newDate = '';

	if(type === 'month'){
		let days = 0;
		for(let i = 0; i < num; i++){
			/*天数设为0，返回上个月的最后一天。月份为0 - 11*/
			month += i;
			let daysCount = new Date(year, month, 0).getDate();
			days += daysCount;
		}

		let millsec = days*aDayMillSec + baseMillSec;
		newDate = formatDate(millsec);
	}else if(type === 'days'){
		let millsec = num*aDayMillSec + baseMillSec;
		newDate = formatDate(millsec);
		
	}

	return newDate;
}

function formatDate(millsec){
	let date = new Date(millsec),
		year = date.getFullYear().toString(),
		month = date.getMonth() + 1,
		day = date.getDate();
	month = formatStyle(month);
	day = formatStyle(day);
	return year+'/'+month+'/'+day;
}

function formatStyle(num){
	if(num < 10){
		num = '0' + num;
	}
	return num.toString();
}



module.exports = router;