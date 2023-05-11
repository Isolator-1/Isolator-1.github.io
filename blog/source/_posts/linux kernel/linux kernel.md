---
title: linux kernel 学习
tags: [驱动开发,kernel漏洞]
date: 2023-05-1 21:07:00
categories: [linux kernel]
excerpt: linux kernel
---

### ubuntu源码编译安装

下载：https://www.kernel.org

必要的编译环境，禁用证书

```shell
sudo apt-get install gcc g++ clang cmake make flex bison libssl-dev
sudo apt-get install openssl
sudo apt-get install libssl-dev libelf-dev 
./scripts/config --disable SYSTEM_TRUSTED_KEYS
./scripts/config --disable SYSTEM_REVOCATION_KEYS
```

编译的配置

```shell
sudo make menuconfig # 最大化终端，否则图形界面显示不出来，使用默认配置直接save然后exit
# 如果不把Enbale loadable module support 勾上，生成的.config就不能modules_install
sudo make -j4 #代表编译线程个数
```

安装

```shell
sudo make modules_install
sudo make install
```

打开引导菜单

```shell
sudo gedit /etc/default/grub # 注释hidden项，修改停留时间GRUB_TIMEOUT=10
sudo update-grub
sudo reboot
```

![](/img/kernel/1.jpg)

多出了新安装的6.3.1的kernel

重启之后`uname -ra`会发现内核版本变了

### 驱动程序编写

```c
//hello.c
#include <linux/init.h>
#include <linux/module.h>

MODULE_LICENSE("haidragon BSD/GPL");

static int hello_init(void){
	printk(KERN_EMERG "Load Hello World\n");
    return 0;
}

static void hello exit(void)
{
    printk(KERN_EMERG "Remove Hello world\n");
}

module_init(hello_init);
module_exit(hello_exit);
```

```makefile
#Makefile
KDIR:= /lib/modules/6.3.1/build
all:
	make -C $(KDIR) M=$(PWD) modules
clean:
	rm -f *.ko *.o *.mod.o *.mod.c *.symvers *.order
```

编译出来的`hello.ko`，用`insmod`安装，用`rmmod`卸载

```shell
sudo insmod ./hello.ko
tail /var/log/kern.log #查看日志
sudo rmmod ./hello.ko
tail /var/log/kern.log #查看日志
```

