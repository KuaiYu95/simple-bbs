# simple-bbs

## second commit
+ 获取用户信息
+ 首页
+ 发帖界面
+ 看帖界面
+ 注册界面
+ 登录界面

## third commit
+ 评论
+ 删帖
+ 删评论
+ 上传头像
+ 验证码

CREATE TABLE posts (
id integer primary key autoincrement,
title string not null,
content string,
owner integer not null,
timestamp integer not null);

CREATE TABLE users (
userId integer primary key autoincrement,
name string unique,
password string not null,
email string unique,
avatar string);

CREATE TABLE comments (
commentId integer primary key autoincrement,
content string not null,
postId integer not null,
ownerId integer not null,
timestamp interger not null);

