---
title: Binarized Network
tags: [pytorch]
date: 2024-09-27 00:00:00
categories: [pytorch]
excerpt: 二值化神经网络
---

## Binarized Network

**前向传播**

把一个正常的NN，所有参数全部二值化，即`torch.sign`，大于等于0的浮点数全部变成1，否则全是-1；然后输入的样本也同样二值化。

这时，在进行前向传播时，【做矩阵乘法，对应元素相乘，最后再相加】的这一过程，转换为【对应元素做XNOR操作，然后POPCOUNT操作】。对应点做XNOR的操作是在模拟元素相乘这一步骤，由于都是±1，可以转为逻辑操作；然后POPCOUNT操作是统计某个向量有多少个1（比如一个向量由5个0和3个1构成，那么POPCOUNT操作结果就是3）

**反向传播**

由于一开始有一个sign函数 $q=sign(r)$ ，loss对模型参数求梯度的时候，$\frac{\partial q}{\partial r}$ 梯度一定为0，没法用传统方法求梯度。所以把sign函数近似成Htanh函数。

$Htanh(x)=Clip(x,-1,1)=max(-1,min(1,x))$函数长这个样子：

![](/img/AI/binarizednetwork1.jpg)

求导就转化成了$\frac{\partial \text { loss }}{\partial r}=\frac{\partial \text { loss }}{\partial q} \frac{\partial H \tanh }{\partial r}$

这样在$r\in [-1,1]$区间内，就有了梯度，梯度是1，其余地方梯度还是0

(抄自 https://segmentfault.com/a/1190000020993594)

```python
input = torch.randn(4, requires_grad = True)
output = torch.sign(input)
loss = output.mean()
loss.backward()
input
tensor([ 0.9303, -1.2768,  0.0069, -0.0968], requires_grad=True)
input.grad
tensor([0., 0., 0., 0.])
```

直接算梯度都是0，修改一下

```python
class LBSign(torch.autograd.Function):
	@staticmethod
	def forward(ctx, input):
        return torch.sign(input)
    @staticmethod
    def backward(ctx, grad_output):
        return grad_output.clamp_(-1, 1)

sign = LBSign.apply
params = torch.randn(4, requires_grad = True)                
output = sign(params)
loss = output.mean()
loss.backward()       

params.grad
tensor(0.5000, grad_fn=<MeanBackward0>)
```
