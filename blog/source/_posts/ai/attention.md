---
title: Attention
tags: [pytorch]
date: 2023-11-22 19:31:00
categories: [pytorch]
excerpt: ai基础知识补习
---

### Nadaraya-Watson核回归

$$
f(x)=\sum_{i=1}^{n} \frac{K(x-x_{i})}{\sum_{j=1}^{n}K(x-x_{j})} y_{i}
$$

如果核函数 $ K(x-x_{i}) $ 越大，则对应的 $y_i$ 的权重越大

核函数为 $ K(x-x_{i}) $为高斯核函数时
$$
K(u)=\frac{1}{\sqrt{2\pi} } \exp{(-\frac{u^{2}}{2})}
$$
代入会得到
$$
f(x)=\sum_{i=1}^{n} softmax(-\frac{1}{2}(x-x_i)^2)y_i
$$
而高斯核函数x与$x_i$越接近，核函数的值越大，根据前文，$y_i$的权重越大

Nadaraya-Watson核回归是一个非参模型

#### 测试

预测 $y_i = 2sin(x_i)+x_i^{0.8} +\epsilon $ 函数