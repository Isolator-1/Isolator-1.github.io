---
title: FUZZ-AFL
tags: [fuzz,afl]
date: 2023-03-15 22:54:00
categories: [fuzz]
excerpt: 模糊测试的学习
---

### AFL

安装afl

```shell
sudo apt-get install afl
```

写一个在特定输入会崩溃的程序 `c1.cpp`

```C++
#include <iostream>
#include <string.h>
using namespace std;
int main()
{
	char ptr[20];
	cin>>ptr;
	if(strcmp(ptr,"deadbeef")==0){
		abort();
	}
	return 0;

}
```

使用afl-g++编译，这样编译出来的程序会被插桩

```shell
afl-g++ -g c1.cpp -o c1.out
```

创建一个`input_folder`，这里`input_folder`里先随便放一个文本文件`abc`，里面写入`hello`。

再创建一个`output_folder`，什么都不用放进去

开始对得到的程序进行fuzz

```shell
afl-fuzz -i ./input_folder -o ./output_folder c1.out
```

> 因为afl在进行模糊测试的时候是将这个`input_folder`里的文件作为输入，然后对给定的输入使用遗传算法不断进行变化，将变化出来的结果继续输入给程序，因此，虽然随便输入什么都是可以的，但是输入的内容与程序崩溃的输入越接近，则afl得到结果的速度越快。



### angr

安装angr：直接用docker，dockerhub上有angr的镜像

```shell
sudo docker pull angr/angr
sudo docker run (--net host) -it angr/angr bash
```

angr的简单例子

```python
>>> import angr
>>> proj = angr.Project('/bin/true') # /bin/true是linux的一个永远return 0的程序
>>> import monkeyhex # 将输出转为16进制，但是docker里并不自带，要pip install一下
>>> proj.arch
<Arch AMD64 (LE)>
>>> proj.entry
0x401670
>>> proj.filename
'/bin/true'
```



