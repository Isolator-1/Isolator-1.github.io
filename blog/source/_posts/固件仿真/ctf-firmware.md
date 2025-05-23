---
title: 固件逆向
tags: [firmware analysis]
date: 2023-05-10 15:58:00
categories: [固件仿真]
excerpt: 各个网站上的固件逆向题目
---

#### 题目1-buuctf-firmware

https://buuoj.cn/challenges#firmware

![](/img/固件仿真/firmware/1.jpg)

使用binwalk提取固件

![](/img/固件仿真/firmware/2.jpg)

可以找到squashfs文件系统，并且可以在/tmp路径下可以找到名为backdoor的程序

![](/img/固件仿真/firmware/3.jpg)

用upx脱壳后寻找类似网址的字符串，找到以下三个

![](/img/固件仿真/firmware/4.jpg)

首先看第一个，它出现在initConnection这个函数，并且建立了这个url的36667端口链接，大概率题目找的就是这个

![](/img/固件仿真/firmware/5.jpg)

第二个、第三个只出现在send函数发送的字符串里，显然不对

![](/img/固件仿真/firmware/6.jpg)

![](/img/固件仿真/firmware/7.jpg)

因此flag = {MD5(echo.byethost51.com:36667)} = {33a422c45d551ac6e4756f59812a954b}



#### 题目2-CTFHUB-二次设备固件逆向

直接打开提供的压缩包，只有一个home文件夹，由于题目中说要找硬编码字符串，直接在文件夹里搜索password之类的字符串

![](/img/固件仿真/firmware/8.jpg)

打开JZPHMISystem，搜索password字符串

![](/img/固件仿真/firmware/9.jpg)

按x找引用到这里，发现了一个叫做inputPassword的函数

![](/img/固件仿真/firmware/10.jpg)

这个函数调用了InputPwd_pro，然后在这个函数里找类似strcmp的函数

![](/img/固件仿真/firmware/11.jpg)

双击这个689078字符串，发现他的名字叫做rootPasswd，那么猜测可能这个就是题目要求的密码

然后打开另一个能搜到password的文件，发现这两个几乎是同样的结构流程

只不过在rootPasswd这里存在区别

![](/img/固件仿真/firmware/12.jpg)

把这个icspwd提交上去就是对的。。。前面那个689078就不行



#### 题目3-CTFHUB-简单的固件逆向分析

用tree查看文件结构之后发现有用的二进制文件只有一个`wwwroot/conf/exec/NOE7701.bin`

使用binwalk提取出来217和217.zlib两个文件

用binwalk -A查看217的架构，发现是PowerPC big-endian

![](/img/固件仿真/firmware/13.jpg)

接下来识别固件的加载地址，通常vxworks内核加载地址为0x10000，但是关于如何验证，见 https://www.cnblogs.com/yangmzh3/p/11231423.html

![](/img/固件仿真/firmware/13_.jpg)

用ida打开，选择PowerPC big-endian[PPC]，使用0x10000作为固件加载地址

![](/img/固件仿真/firmware/14.jpg)

![](/img/固件仿真/firmware/15.jpg)

发现ida识别不出来函数，由于固件里编入了符号表，可以手动恢复函数名

从网上找了这个idc脚本，用于恢复VxWorks符号表

```c
/* 脚本内容 */
/* Ruben Santamarta - IOActive */
/* Rebuild VxWorks Symbol Table */

#include <idc.idc>

static main()
{
     auto load_addr;
	 auto ea;
	 auto offset;
	 auto sName;
	 auto eaStart;
	 auto eaEnd; 

	// You'll need to adjust these values
	load_addr = 0x10000; /* 加载地址 */ 
	eaStart = 0x301E74 + load_addr; /* 符号表起始地 */
	eaEnd = 0x3293b4 + load_addr; /* 符号表结束地址 */
	
	 SetStatus(IDA_STATUS_WORK);
	 ea = eaStart;
	 
	 while( ea < eaEnd) {
	 	MakeDword( ea );
	 	offset = 0;
	 	if ( Dword( ea ) == 0x900 || Dword( ea ) == 0x500)
	 	{
	 		offset = 8;
	 	}
	 	else if( Dword( ea ) == 0x90000 || Dword( ea ) == 0x50000 )
	 	{	
	 		offset = 0xc;
	 	}	 	
	 	if( offset )
	 	{
	 		MakeStr( Dword( ea - offset ), BADADDR);	 		
	 		sName = GetString( Dword( ea - offset ), -1, ASCSTR_C ) ; 
	 	 	if ( sName )
	 	 	{
	 	 		if( Dword( ea ) == 0x500 || Dword( ea ) == 0x50000)
	 	 		{
	 	 	    	if (  GetFunctionName( Dword( ea - offset + 4) ) == "" )
	 	 	    	{
	 	 	    		MakeCode( Dword( ea - offset + 4) );
	 					MakeFunction( Dword( ea - offset + 4), BADADDR );	
	 	 	    	}
	 	 	    }
	 	 		MakeName( Dword( ea - offset + 4 ), sName ); 	 		
	 	 	}
	 	}
	 	ea = ea + 4; 	 	 	
	 }
	 
	 SetStatus(IDA_STATUS_READY);
}
```

导入之后函数确实恢复出来了

如果直接搜ftpuser字符串，它下面这个就是密码，也就是flag答案...

![](/img/firmware/16.jpg)

不做具体分析了（代码太多