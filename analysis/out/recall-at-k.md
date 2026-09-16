# Recall@k of the ranked-parent files (gold hierarchy, test split)

Unit = gold-mapped concept whose gold cluster has an ancestor over the split's edges (the sound% denominator). `trans.` = credit for any gold ancestor, `direct` = the direct gold parent only; `cov.` = share of units whose ancestor cluster has any concept in this arm's scheme (the ceiling). 95% percentile bootstrap over units (1000 resamples, seed 42) on R@10 (trans.).

## software

| arm | method | n | cov. | R@1 | R@5 | R@10 | MRR | R@10 CI | direct R@1 | R@5 | R@10 | direct MRR |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| t-a1-flash-gembed2-r1-35bc1387d473 | euclid | 143 | 98% | 12.6 | 32.2 | 46.9 | 0.210 | [39, 55] | 12.6 | 32.2 | 46.9 | 0.210 |
| t-a1-flash-gembed2-r1-35bc1387d473 | euclid-normfilter | 143 | 98% | 14.0 | 28.0 | 39.9 | 0.203 | [32, 48] | 14.0 | 27.3 | 39.2 | 0.200 |
| t-a1-flash-gembed2-r1-35bc1387d473 | euclid-normfilter-gloss | 143 | 98% | 7.7 | 19.6 | 31.5 | 0.137 | [24, 39] | 7.7 | 19.6 | 31.5 | 0.137 |
| t-a1-flash-gembed2-r1-35bc1387d473 | hit-zeroshot | 143 | 98% | 7.0 | 18.2 | 25.2 | 0.118 | [18, 32] | 6.3 | 17.5 | 24.5 | 0.111 |
| t-a1-flash-gembed2-r1-35bc1387d473 | hit-zeroshot-gloss | 143 | 98% | 2.8 | 10.5 | 14.0 | 0.059 | [8, 20] | 2.8 | 10.5 | 14.0 | 0.059 |
| t-a2-flash-egemma-r1-a7d0a4e56984 | euclid | 133 | 97% | 9.8 | 29.3 | 43.6 | 0.189 | [36, 52] | 9.8 | 28.6 | 43.6 | 0.186 |
| t-a2-flash-egemma-r1-a7d0a4e56984 | euclid-normfilter | 133 | 97% | 11.3 | 27.1 | 37.6 | 0.180 | [29, 46] | 10.5 | 26.3 | 36.8 | 0.172 |
| t-a2-flash-egemma-r1-a7d0a4e56984 | euclid-normfilter-gloss | 133 | 97% | 9.8 | 24.1 | 36.8 | 0.168 | [29, 46] | 9.8 | 24.1 | 36.8 | 0.167 |
| t-a2-flash-egemma-r1-a7d0a4e56984 | hit-zeroshot | 133 | 97% | 5.3 | 15.8 | 22.6 | 0.097 | [15, 30] | 4.5 | 15.0 | 21.8 | 0.089 |
| t-a2-flash-egemma-r1-a7d0a4e56984 | hit-zeroshot-gloss | 133 | 97% | 3.8 | 10.5 | 15.8 | 0.069 | [10, 22] | 3.8 | 10.5 | 15.8 | 0.069 |
| t-b1-31b-egemma-r1-4337e00db336 | euclid | 141 | 100% | 12.1 | 31.2 | 42.6 | 0.198 | [35, 51] | 12.1 | 31.2 | 41.8 | 0.197 |
| t-b1-31b-egemma-r1-4337e00db336 | euclid-normfilter | 141 | 100% | 14.2 | 33.3 | 41.1 | 0.213 | [33, 49] | 14.2 | 32.6 | 40.4 | 0.209 |
| t-b1-31b-egemma-r1-4337e00db336 | euclid-normfilter-gloss | 141 | 100% | 10.6 | 29.1 | 41.8 | 0.183 | [33, 50] | 10.6 | 28.4 | 41.8 | 0.183 |
| t-b1-31b-egemma-r1-4337e00db336 | hit-zeroshot | 141 | 100% | 7.1 | 17.7 | 24.1 | 0.117 | [18, 31] | 6.4 | 17.0 | 23.4 | 0.110 |
| t-b1-31b-egemma-r1-4337e00db336 | hit-zeroshot-gloss | 141 | 100% | 6.4 | 14.9 | 24.1 | 0.107 | [17, 30] | 6.4 | 14.9 | 23.4 | 0.106 |
| t-b2-31b-gembed2-r3-1f86ee33b8cc | euclid | 138 | 99% | 13.8 | 31.2 | 49.3 | 0.218 | [41, 57] | 13.8 | 31.2 | 49.3 | 0.218 |
| t-b2-31b-gembed2-r3-1f86ee33b8cc | euclid-normfilter | 138 | 99% | 12.3 | 30.4 | 36.2 | 0.197 | [28, 44] | 12.3 | 30.4 | 36.2 | 0.197 |
| t-b2-31b-gembed2-r3-1f86ee33b8cc | euclid-normfilter-gloss | 138 | 99% | 13.0 | 23.9 | 31.2 | 0.178 | [23, 38] | 13.0 | 23.9 | 31.2 | 0.178 |
| t-b2-31b-gembed2-r3-1f86ee33b8cc | hit-zeroshot | 138 | 99% | 7.2 | 17.4 | 24.6 | 0.117 | [17, 32] | 6.5 | 16.7 | 23.9 | 0.109 |
| t-b2-31b-gembed2-r3-1f86ee33b8cc | hit-zeroshot-gloss | 138 | 99% | 8.0 | 18.1 | 23.9 | 0.118 | [17, 31] | 8.0 | 18.1 | 23.9 | 0.118 |

## sector

| arm | method | n | cov. | R@1 | R@5 | R@10 | MRR | R@10 CI | direct R@1 | R@5 | R@10 | direct MRR |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| t-a1-flash-gembed2-r1-35bc1387d473 | euclid | 52 | 100% | 28.8 | 61.5 | 73.1 | 0.418 | [62, 85] | 23.1 | 44.2 | 53.8 | 0.317 |
| t-a1-flash-gembed2-r1-35bc1387d473 | euclid-normfilter | 52 | 100% | 23.1 | 50.0 | 63.5 | 0.351 | [50, 77] | 13.5 | 36.5 | 44.2 | 0.234 |
| t-a1-flash-gembed2-r1-35bc1387d473 | euclid-normfilter-gloss | 52 | 100% | 30.8 | 65.4 | 71.2 | 0.437 | [60, 83] | 15.4 | 32.7 | 38.5 | 0.228 |
| t-a1-flash-gembed2-r1-35bc1387d473 | hit-zeroshot | 52 | 100% | 17.3 | 42.3 | 55.8 | 0.293 | [42, 69] | 15.4 | 36.5 | 44.2 | 0.248 |
| t-a1-flash-gembed2-r1-35bc1387d473 | hit-zeroshot-gloss | 52 | 100% | 21.2 | 51.9 | 63.5 | 0.327 | [52, 77] | 9.6 | 23.1 | 32.7 | 0.166 |
| t-a2-flash-egemma-r1-a7d0a4e56984 | euclid | 55 | 100% | 32.7 | 72.7 | 85.5 | 0.493 | [76, 95] | 27.3 | 69.1 | 83.6 | 0.440 |
| t-a2-flash-egemma-r1-a7d0a4e56984 | euclid-normfilter | 55 | 100% | 27.3 | 56.4 | 63.6 | 0.401 | [51, 76] | 23.6 | 45.5 | 52.7 | 0.322 |
| t-a2-flash-egemma-r1-a7d0a4e56984 | euclid-normfilter-gloss | 55 | 100% | 32.7 | 60.0 | 69.1 | 0.463 | [56, 82] | 25.5 | 45.5 | 56.4 | 0.354 |
| t-a2-flash-egemma-r1-a7d0a4e56984 | hit-zeroshot | 55 | 100% | 20.0 | 45.5 | 56.4 | 0.318 | [44, 69] | 16.4 | 38.2 | 45.5 | 0.256 |
| t-a2-flash-egemma-r1-a7d0a4e56984 | hit-zeroshot-gloss | 55 | 100% | 23.6 | 49.1 | 65.5 | 0.347 | [53, 78] | 14.5 | 34.5 | 47.3 | 0.229 |
| t-b1-31b-egemma-r1-4337e00db336 | euclid | 52 | 100% | 36.5 | 76.9 | 84.6 | 0.522 | [73, 94] | 30.8 | 69.2 | 78.8 | 0.458 |
| t-b1-31b-egemma-r1-4337e00db336 | euclid-normfilter | 52 | 100% | 32.7 | 63.5 | 71.2 | 0.456 | [58, 85] | 25.0 | 48.1 | 53.8 | 0.345 |
| t-b1-31b-egemma-r1-4337e00db336 | euclid-normfilter-gloss | 52 | 100% | 32.7 | 67.3 | 73.1 | 0.473 | [60, 85] | 26.9 | 48.1 | 53.8 | 0.368 |
| t-b1-31b-egemma-r1-4337e00db336 | hit-zeroshot | 52 | 100% | 19.2 | 44.2 | 55.8 | 0.310 | [42, 69] | 15.4 | 36.5 | 44.2 | 0.251 |
| t-b1-31b-egemma-r1-4337e00db336 | hit-zeroshot-gloss | 52 | 100% | 17.3 | 51.9 | 75.0 | 0.341 | [63, 87] | 13.5 | 38.5 | 50.0 | 0.246 |
| t-b2-31b-gembed2-r3-1f86ee33b8cc | euclid | 51 | 100% | 25.5 | 58.8 | 80.4 | 0.432 | [69, 90] | 23.5 | 54.9 | 74.5 | 0.396 |
| t-b2-31b-gembed2-r3-1f86ee33b8cc | euclid-normfilter | 51 | 100% | 25.5 | 58.8 | 74.5 | 0.390 | [63, 86] | 21.6 | 43.1 | 58.8 | 0.312 |
| t-b2-31b-gembed2-r3-1f86ee33b8cc | euclid-normfilter-gloss | 51 | 100% | 27.5 | 64.7 | 74.5 | 0.413 | [63, 86] | 21.6 | 52.9 | 60.8 | 0.341 |
| t-b2-31b-gembed2-r3-1f86ee33b8cc | hit-zeroshot | 51 | 100% | 25.5 | 45.1 | 54.9 | 0.351 | [41, 69] | 21.6 | 39.2 | 45.1 | 0.292 |
| t-b2-31b-gembed2-r3-1f86ee33b8cc | hit-zeroshot-gloss | 51 | 100% | 29.4 | 52.9 | 66.7 | 0.398 | [53, 78] | 21.6 | 43.1 | 54.9 | 0.322 |

## government-body

| arm | method | n | cov. | R@1 | R@5 | R@10 | MRR | R@10 CI | direct R@1 | R@5 | R@10 | direct MRR |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| t-a1-flash-gembed2-r1-35bc1387d473 | euclid | 27 | 100% | 33.3 | 51.9 | 63.0 | 0.433 | [44, 81] | 33.3 | 51.9 | 63.0 | 0.424 |
| t-a1-flash-gembed2-r1-35bc1387d473 | euclid-normfilter | 27 | 100% | 7.4 | 22.2 | 25.9 | 0.130 | [11, 41] | 7.4 | 22.2 | 22.2 | 0.117 |
| t-a1-flash-gembed2-r1-35bc1387d473 | euclid-normfilter-gloss | 27 | 100% | 7.4 | 29.6 | 44.4 | 0.189 | [26, 63] | 7.4 | 25.9 | 29.6 | 0.153 |
| t-a1-flash-gembed2-r1-35bc1387d473 | hit-zeroshot | 27 | 100% | 7.4 | 14.8 | 18.5 | 0.115 | [4, 33] | 7.4 | 14.8 | 18.5 | 0.115 |
| t-a1-flash-gembed2-r1-35bc1387d473 | hit-zeroshot-gloss | 27 | 100% | 3.7 | 22.2 | 33.3 | 0.108 | [18, 52] | 3.7 | 14.8 | 22.2 | 0.086 |
| t-a2-flash-egemma-r1-a7d0a4e56984 | euclid | 27 | 100% | 29.6 | 40.7 | 55.6 | 0.367 | [37, 74] | 29.6 | 40.7 | 55.6 | 0.367 |
| t-a2-flash-egemma-r1-a7d0a4e56984 | euclid-normfilter | 27 | 100% | 11.1 | 14.8 | 25.9 | 0.130 | [11, 41] | 11.1 | 14.8 | 22.2 | 0.127 |
| t-a2-flash-egemma-r1-a7d0a4e56984 | euclid-normfilter-gloss | 27 | 100% | 11.1 | 29.6 | 33.3 | 0.170 | [18, 52] | 11.1 | 25.9 | 29.6 | 0.161 |
| t-a2-flash-egemma-r1-a7d0a4e56984 | hit-zeroshot | 27 | 100% | 7.4 | 14.8 | 18.5 | 0.115 | [4, 33] | 7.4 | 14.8 | 18.5 | 0.115 |
| t-a2-flash-egemma-r1-a7d0a4e56984 | hit-zeroshot-gloss | 27 | 100% | 0.0 | 18.5 | 33.3 | 0.089 | [18, 52] | 0.0 | 18.5 | 29.6 | 0.083 |
| t-b1-31b-egemma-r1-4337e00db336 | euclid | 30 | 100% | 23.3 | 56.7 | 63.3 | 0.395 | [43, 80] | 23.3 | 56.7 | 63.3 | 0.395 |
| t-b1-31b-egemma-r1-4337e00db336 | euclid-normfilter | 30 | 100% | 10.0 | 23.3 | 30.0 | 0.165 | [13, 47] | 10.0 | 23.3 | 30.0 | 0.165 |
| t-b1-31b-egemma-r1-4337e00db336 | euclid-normfilter-gloss | 30 | 100% | 23.3 | 40.0 | 43.3 | 0.310 | [27, 60] | 23.3 | 40.0 | 43.3 | 0.310 |
| t-b1-31b-egemma-r1-4337e00db336 | hit-zeroshot | 30 | 100% | 3.3 | 6.7 | 13.3 | 0.059 | [3, 27] | 3.3 | 6.7 | 13.3 | 0.059 |
| t-b1-31b-egemma-r1-4337e00db336 | hit-zeroshot-gloss | 30 | 100% | 0.0 | 16.7 | 36.7 | 0.084 | [20, 53] | 0.0 | 16.7 | 36.7 | 0.084 |
| t-b2-31b-gembed2-r3-1f86ee33b8cc | euclid | 25 | 100% | 28.0 | 60.0 | 64.0 | 0.400 | [44, 80] | 28.0 | 60.0 | 64.0 | 0.400 |
| t-b2-31b-gembed2-r3-1f86ee33b8cc | euclid-normfilter | 25 | 100% | 16.0 | 28.0 | 32.0 | 0.215 | [16, 52] | 12.0 | 24.0 | 28.0 | 0.175 |
| t-b2-31b-gembed2-r3-1f86ee33b8cc | euclid-normfilter-gloss | 25 | 100% | 20.0 | 36.0 | 40.0 | 0.259 | [20, 60] | 20.0 | 36.0 | 40.0 | 0.259 |
| t-b2-31b-gembed2-r3-1f86ee33b8cc | hit-zeroshot | 25 | 100% | 8.0 | 16.0 | 20.0 | 0.124 | [4, 36] | 8.0 | 16.0 | 20.0 | 0.124 |
| t-b2-31b-gembed2-r3-1f86ee33b8cc | hit-zeroshot-gloss | 25 | 100% | 4.0 | 8.0 | 28.0 | 0.079 | [12, 48] | 4.0 | 8.0 | 28.0 | 0.079 |

## organization

| arm | method | n | cov. | R@1 | R@5 | R@10 | MRR | R@10 CI | direct R@1 | R@5 | R@10 | direct MRR |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| t-a1-flash-gembed2-r1-35bc1387d473 | euclid | 8 | 100% | 50.0 | 50.0 | 62.5 | 0.514 | [25, 100] | 50.0 | 50.0 | 62.5 | 0.514 |
| t-a1-flash-gembed2-r1-35bc1387d473 | euclid-normfilter | 8 | 100% | 37.5 | 37.5 | 50.0 | 0.389 | [12, 88] | 37.5 | 37.5 | 50.0 | 0.389 |
| t-a1-flash-gembed2-r1-35bc1387d473 | euclid-normfilter-gloss | 8 | 100% | 37.5 | 37.5 | 50.0 | 0.396 | [12, 88] | 37.5 | 37.5 | 50.0 | 0.396 |
| t-a1-flash-gembed2-r1-35bc1387d473 | hit-zeroshot | 8 | 100% | 12.5 | 12.5 | 12.5 | 0.125 | [0, 38] | 12.5 | 12.5 | 12.5 | 0.125 |
| t-a1-flash-gembed2-r1-35bc1387d473 | hit-zeroshot-gloss | 8 | 100% | 12.5 | 25.0 | 25.0 | 0.167 | [0, 50] | 12.5 | 25.0 | 25.0 | 0.167 |
| t-a2-flash-egemma-r1-a7d0a4e56984 | euclid | 8 | 100% | 25.0 | 50.0 | 62.5 | 0.346 | [25, 100] | 25.0 | 50.0 | 62.5 | 0.346 |
| t-a2-flash-egemma-r1-a7d0a4e56984 | euclid-normfilter | 8 | 100% | 25.0 | 37.5 | 50.0 | 0.325 | [12, 88] | 25.0 | 37.5 | 50.0 | 0.325 |
| t-a2-flash-egemma-r1-a7d0a4e56984 | euclid-normfilter-gloss | 8 | 100% | 25.0 | 37.5 | 37.5 | 0.292 | [12, 75] | 25.0 | 37.5 | 37.5 | 0.292 |
| t-a2-flash-egemma-r1-a7d0a4e56984 | hit-zeroshot | 8 | 100% | 12.5 | 12.5 | 12.5 | 0.125 | [0, 38] | 12.5 | 12.5 | 12.5 | 0.125 |
| t-a2-flash-egemma-r1-a7d0a4e56984 | hit-zeroshot-gloss | 8 | 100% | 12.5 | 12.5 | 12.5 | 0.125 | [0, 38] | 12.5 | 12.5 | 12.5 | 0.125 |
| t-b1-31b-egemma-r1-4337e00db336 | euclid | 8 | 100% | 37.5 | 37.5 | 37.5 | 0.375 | [12, 75] | 37.5 | 37.5 | 37.5 | 0.375 |
| t-b1-31b-egemma-r1-4337e00db336 | euclid-normfilter | 8 | 100% | 25.0 | 25.0 | 25.0 | 0.250 | [0, 50] | 25.0 | 25.0 | 25.0 | 0.250 |
| t-b1-31b-egemma-r1-4337e00db336 | euclid-normfilter-gloss | 8 | 100% | 25.0 | 25.0 | 25.0 | 0.250 | [0, 50] | 25.0 | 25.0 | 25.0 | 0.250 |
| t-b1-31b-egemma-r1-4337e00db336 | hit-zeroshot | 8 | 100% | 12.5 | 12.5 | 12.5 | 0.125 | [0, 38] | 12.5 | 12.5 | 12.5 | 0.125 |
| t-b1-31b-egemma-r1-4337e00db336 | hit-zeroshot-gloss | 8 | 100% | 0.0 | 25.0 | 25.0 | 0.094 | [0, 50] | 0.0 | 25.0 | 25.0 | 0.094 |
| t-b2-31b-gembed2-r3-1f86ee33b8cc | euclid | 8 | 100% | 50.0 | 50.0 | 50.0 | 0.500 | [12, 88] | 50.0 | 50.0 | 50.0 | 0.500 |
| t-b2-31b-gembed2-r3-1f86ee33b8cc | euclid-normfilter | 8 | 100% | 37.5 | 37.5 | 37.5 | 0.375 | [12, 75] | 37.5 | 37.5 | 37.5 | 0.375 |
| t-b2-31b-gembed2-r3-1f86ee33b8cc | euclid-normfilter-gloss | 8 | 100% | 12.5 | 12.5 | 12.5 | 0.125 | [0, 38] | 12.5 | 12.5 | 12.5 | 0.125 |
| t-b2-31b-gembed2-r3-1f86ee33b8cc | hit-zeroshot | 8 | 100% | 12.5 | 12.5 | 12.5 | 0.125 | [0, 38] | 12.5 | 12.5 | 12.5 | 0.125 |
| t-b2-31b-gembed2-r3-1f86ee33b8cc | hit-zeroshot-gloss | 8 | 100% | 0.0 | 12.5 | 12.5 | 0.062 | [0, 38] | 0.0 | 12.5 | 12.5 | 0.062 |

## device

| arm | method | n | cov. | R@1 | R@5 | R@10 | MRR | R@10 CI | direct R@1 | R@5 | R@10 | direct MRR |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| t-a1-flash-gembed2-r1-35bc1387d473 | euclid | 2 | 100% | 0.0 | 50.0 | 50.0 | 0.100 | [0, 100] | 0.0 | 50.0 | 50.0 | 0.100 |
| t-a1-flash-gembed2-r1-35bc1387d473 | euclid-normfilter | 2 | 100% | 0.0 | 0.0 | 50.0 | 0.050 | [0, 100] | 0.0 | 0.0 | 50.0 | 0.050 |
| t-a1-flash-gembed2-r1-35bc1387d473 | euclid-normfilter-gloss | 2 | 100% | 0.0 | 50.0 | 50.0 | 0.167 | [0, 100] | 0.0 | 50.0 | 50.0 | 0.167 |
| t-a1-flash-gembed2-r1-35bc1387d473 | hit-zeroshot | 2 | 100% | 0.0 | 0.0 | 0.0 | 0.000 | [0, 0] | 0.0 | 0.0 | 0.0 | 0.000 |
| t-a1-flash-gembed2-r1-35bc1387d473 | hit-zeroshot-gloss | 2 | 100% | 0.0 | 50.0 | 50.0 | 0.167 | [0, 100] | 0.0 | 50.0 | 50.0 | 0.167 |
| t-a2-flash-egemma-r1-a7d0a4e56984 | euclid | 2 | 100% | 50.0 | 50.0 | 100.0 | 0.550 | [100, 100] | 50.0 | 50.0 | 100.0 | 0.550 |
| t-a2-flash-egemma-r1-a7d0a4e56984 | euclid-normfilter | 2 | 100% | 0.0 | 0.0 | 50.0 | 0.062 | [0, 100] | 0.0 | 0.0 | 50.0 | 0.062 |
| t-a2-flash-egemma-r1-a7d0a4e56984 | euclid-normfilter-gloss | 2 | 100% | 50.0 | 50.0 | 100.0 | 0.562 | [100, 100] | 50.0 | 50.0 | 100.0 | 0.562 |
| t-a2-flash-egemma-r1-a7d0a4e56984 | hit-zeroshot | 2 | 100% | 0.0 | 0.0 | 0.0 | 0.000 | [0, 0] | 0.0 | 0.0 | 0.0 | 0.000 |
| t-a2-flash-egemma-r1-a7d0a4e56984 | hit-zeroshot-gloss | 2 | 100% | 0.0 | 50.0 | 100.0 | 0.229 | [100, 100] | 0.0 | 50.0 | 100.0 | 0.229 |
| t-b1-31b-egemma-r1-4337e00db336 | euclid | 2 | 100% | 50.0 | 100.0 | 100.0 | 0.667 | [100, 100] | 50.0 | 100.0 | 100.0 | 0.667 |
| t-b1-31b-egemma-r1-4337e00db336 | euclid-normfilter | 2 | 100% | 0.0 | 50.0 | 50.0 | 0.167 | [0, 100] | 0.0 | 50.0 | 50.0 | 0.167 |
| t-b1-31b-egemma-r1-4337e00db336 | euclid-normfilter-gloss | 2 | 100% | 50.0 | 50.0 | 50.0 | 0.500 | [0, 100] | 50.0 | 50.0 | 50.0 | 0.500 |
| t-b1-31b-egemma-r1-4337e00db336 | hit-zeroshot | 2 | 100% | 0.0 | 0.0 | 0.0 | 0.000 | [0, 0] | 0.0 | 0.0 | 0.0 | 0.000 |
| t-b1-31b-egemma-r1-4337e00db336 | hit-zeroshot-gloss | 2 | 100% | 0.0 | 50.0 | 50.0 | 0.167 | [0, 100] | 0.0 | 50.0 | 50.0 | 0.167 |
| t-b2-31b-gembed2-r3-1f86ee33b8cc | euclid | 2 | 100% | 0.0 | 50.0 | 100.0 | 0.208 | [100, 100] | 0.0 | 50.0 | 100.0 | 0.208 |
| t-b2-31b-gembed2-r3-1f86ee33b8cc | euclid-normfilter | 2 | 100% | 0.0 | 0.0 | 50.0 | 0.083 | [0, 100] | 0.0 | 0.0 | 50.0 | 0.083 |
| t-b2-31b-gembed2-r3-1f86ee33b8cc | euclid-normfilter-gloss | 2 | 100% | 0.0 | 50.0 | 50.0 | 0.250 | [0, 100] | 0.0 | 50.0 | 50.0 | 0.250 |
| t-b2-31b-gembed2-r3-1f86ee33b8cc | hit-zeroshot | 2 | 100% | 0.0 | 0.0 | 0.0 | 0.000 | [0, 0] | 0.0 | 0.0 | 0.0 | 0.000 |
| t-b2-31b-gembed2-r3-1f86ee33b8cc | hit-zeroshot-gloss | 2 | 100% | 0.0 | 0.0 | 50.0 | 0.071 | [0, 100] | 0.0 | 0.0 | 50.0 | 0.071 |

