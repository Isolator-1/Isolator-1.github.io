---
title: 固件逆向
tags: [firmware analysis]
date: 2023-05-10 15:58:00
categories: [固件仿真]
excerpt: 各个网站上的固件逆向题目
---

#### 题目1-buuctf-firmware

https://buuoj.cn/challenges#firmware

![](/img/firmware/1.jpg)

使用binwalk提取固件

![](/img/firmware/2.jpg)

可以找到squashfs文件系统，并且可以在/tmp路径下可以找到名为backdoor的程序

![](/img/firmware/3.jpg)

用upx脱壳后寻找类似网址的字符串，找到以下三个

![](/img/firmware/4.jpg)

首先看第一个，它出现在initConnection这个函数，并且建立了这个url的36667端口链接，大概率题目找的就是这个

![](/img/firmware/5.jpg)

第二个、第三个只出现在send函数发送的字符串里，显然不对

![](/img/firmware/6.jpg)

![](/img/firmware/7.jpg)

因此flag = {MD5(echo.byethost51.com:36667)} = {33a422c45d551ac6e4756f59812a954b}



#### 题目2-CTFHUB-二次设备固件逆向

直接打开提供的压缩包，只有一个home文件夹，由于题目中说要找硬编码字符串，直接在文件夹里搜索password之类的字符串

![](/img/firmware/8.jpg)

打开JZPHMISystem，搜索password字符串

![](/img/firmware/9.jpg)

按x找引用到这里，发现了一个叫做inputPassword的函数

![](/img/firmware/10.jpg)

这个函数调用了InputPwd_pro，然后在这个函数里找类似strcmp的函数

![](/img/firmware/11.jpg)

双击这个689078字符串，发现他的名字叫做rootPasswd，那么猜测可能这个就是题目要求的密码

然后打开另一个能搜到password的文件，发现这两个几乎是同样的结构流程

只不过在rootPasswd这里存在区别

![](/img/firmware/12.jpg)

把这个icspwd提交上去就是对的。。。前面那个689078就不行



#### 题目3-CTFHUB-简单的固件逆向分析

用tree查看文件结构之后发现有用的二进制文件只有一个`wwwroot/conf/exec/NOE7701.bin`

使用binwalk提取出来217和217.zlib两个文件

用binwalk -A查看217的架构，发现是PowerPC big-endian

![](/img/firmware/13.jpg)

接下来识别固件的加载地址，通常vxworks内核加载地址为0x10000，但是关于如何验证，见 https://www.cnblogs.com/yangmzh3/p/11231423.html

![](/img/firmware/13_.jpg)

用ida打开，选择PowerPC big-endian[PPC]，使用0x10000作为固件加载地址

![](/img/firmware/14.jpg)

![](/img/firmware/15.jpg)

发现ida识别不出来函数

