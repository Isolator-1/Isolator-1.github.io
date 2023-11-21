---
title: linear regression 2
tags: [pytorch]
date: 2023-11-19 01:00:00
categories: [pytorch]
excerpt: ai基础知识补习
---



```python
import numpy as np
import torch
from torch.utils import data
from d2l import torch as d2l
```


```python
true_w = torch.tensor([2, -3.4])
true_b = 4.2
features, labels = d2l.synthetic_data(true_w, true_b, 1000)
print(features.shape, labels.shape)
```

    torch.Size([1000, 2]) torch.Size([1000, 1])



```python
def load_array(data_arrays, batch_size ,is_train=True):
    dataset = data.TensorDataset(*data_arrays)
    return data.DataLoader(dataset, batch_size, shuffle=is_train)
```


```python
batchsize = 10
data_iter = load_array((features, labels), batchsize)
next(iter(data_iter))
```




    [tensor([[ 0.5940, -1.2375],
             [-0.0840, -0.2979],
             [-0.6866, -0.0931],
             [-0.7088,  1.3270],
             [ 1.0423,  0.6539],
             [ 0.8156,  0.4527],
             [ 0.5195, -0.3563],
             [ 1.5992, -0.2122],
             [ 0.9235,  0.7968],
             [ 1.7633,  1.0517]]),
     tensor([[ 9.6162],
             [ 5.0296],
             [ 3.1477],
             [-1.7288],
             [ 4.0441],
             [ 4.2969],
             [ 6.4594],
             [ 8.1204],
             [ 3.3252],
             [ 4.1758]])]




```python
from torch import nn
net = nn.Sequential(nn.Linear(2,1))
net[0].weight.data.normal_(0,0.01)
net[0].bias.data.fill_(0)
```




    tensor([0.])




```python
loss = nn.MSELoss()
trainer = torch.optim.SGD(net.parameters(), lr = 0.03)
```


```python
num_epochs = 3
for epoch in range(num_epochs):
    for X, y in data_iter:
        l = loss(net(X) ,y)
        trainer.zero_grad()
        l.backward()
        trainer.step()
    l = loss(net(features), labels)
    print(f'epoch {epoch + 1}, loss {l:f}')
```

    epoch 1, loss 0.000310
    epoch 2, loss 0.000098
    epoch 3, loss 0.000098



```python
w = net[0].weight.data
print('w的估计误差：', true_w - w.reshape(true_w.shape))
b = net[0].bias.data
print('b的估计误差：', true_b - b)
```

    w的估计误差： tensor([0.0002, 0.0010])
    b的估计误差： tensor([0.0007])



```python
print(net)
```

    Sequential(
      (0): Linear(in_features=2, out_features=1, bias=True)
    )



```python
w_grad = net[0].weight.grad
print('w的梯度：', w_grad)
b_grad = net[0].bias.grad
print('b的梯度：', b_grad)
```

    w的梯度： tensor([[0.0019, 0.0058]])
    b的梯度： tensor([0.0047])

