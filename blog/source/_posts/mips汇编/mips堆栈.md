---
title: mips的堆栈
tags: [assembly]
date: 2022-12-23 16:08:00
categories: [mips汇编]
excerpt: mips堆栈知识
---

#### MIPS的栈💣

1. 栈增长方向：同x86，向低地址增长

2. 没有EBP指针（但是有一个fp，见MIPS汇编这篇文章）
3. 传参：前四个参数通过$a0~$a3传递，多出的参数放入栈空间
4. 返回值：$RA寄存器 

#### 函数调用过程

1. 将$PC寄存器移到$RA寄存器
2. 如果被调用的函数是如果是非叶函数（调用其他函数），将$RA存在栈；叶函数则不变
3. 函数返回时，叶函数直接 `jr $RA`，非叶函数先把返回地址存入$RA再跳转

《家用路由器0day漏洞挖掘》这本书上的图例：

![](/img/mips/1.jpg)

##### 演示

1. 创建 `more argument.c`

   ```C
   //more argument.c
   #include <stdio.h>
   int more_arg(int a,int b,int c,int d,int e)
   {
       char dst[100] = {0};
       sprintf(dst,"%d%d%d%d%d\n",a,b,c,d,e);
   }
   void main()
   {
       int a1=1;
       int a2=2;
       int a3=3;
       int a4=4;
       int a5=5;
       more_arg(a1,a2,a3,a4,a5);
       return ;
   }
   ```

2. 编译

   ```
   mips-linux-gnu-gcc ./more\ argument.c  -o   more\ argument
   ```

3. ida打开

   首先可以看到前四个参数存入了$a0~$a3

   ![](/img/mips/2.jpg)

   然后前面5个：
   
   ```assembly
   li      $v0, ?
   sw      $v0, 0x??+var_18($fp)
   ```
   
   是赋值操作，因此中间的
   
   ```assembly
   lw      $v0, 0x38+var_8($fp)
   sw      $v0, 0x38+var_28($sp)
   ```
   
   即为第五个参数的传递

   在more argument函数中
   
   ![](/img/mips/3.jpg)
   
   首先把前四个参数，存入main函数给more argument函数预留的参数空间
   
   这部分的栈依旧属于main函数，其余内容如上图，`var_s0`是保存现场，`arg_10`是main函数已经存好的第五个参数
   
   ![](/img/mips/4.jpg)
   
   