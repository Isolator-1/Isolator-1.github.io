---
title: vulnhub 做题 BEELZEBUB:1 
tags: [penetration]
date: 2024-10-16 00:00:00
categories: [penetration]
excerpt: day5
---

##  做题 BEELZEBUB: 1 

### 扫描

```zsh
22/tcp open  ssh     OpenSSH 7.6p1 Ubuntu 4ubuntu0.3 (Ubuntu Linux; protocol 2.0)
80/tcp open  http    Apache httpd 2.4.29 ((Ubuntu))
```
只开了两个端口，爆破一下目录

![](/img/pene/7.png)

在 /phpmyadmin 路径上，是一个登录界面，然后在此基础之上继续扫描路径，有一个 setup 访问会 alert 一个界面，要输入用户密码，这里找不到更多信息了

换一个字典扫一扫非路径而是文件的

![](/img/pene/8.png)

似乎没什么特别的，但是挨个访问时， index.php 又是404 ，而且报错是`Apache/2.4.30 (Ubuntu)`，其他的报错都是`Apache/2.4.29 (Ubuntu) Server at 192.168.169.135 Port 80`，访问这个源代码的时候看到了提示信息

```
My heart was encrypted, "beelzebub" somehow hacked and decoded it.-md5
```

cmd5解密之后：`d18e1e22becbd915b45e0e655429d487`

看了一眼题解，说这东西是网站的资源路径，然后访问不到，又看了一眼，说是要在此基础之上继续路径爆破😅，感觉也没啥意思，就这么滴吧

扫到了wp-include路径，然后题解又说有一个wp-login.php，但是我没扫到，并且这个页面能显示标题，但是内容始终加载不出来（所以才没扫到吧） 可能有些资源要联网甚至翻墙？

到这里我也不知道咋回事，就这么算了吧，感觉没啥意思的一道题
