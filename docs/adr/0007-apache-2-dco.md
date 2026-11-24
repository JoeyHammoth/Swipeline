# 0007: Apache-2.0 with DCO, no CLA

**Status:** accepted

All code is Apache-2.0 and contributions are accepted under the Developer
Certificate of Origin (`git commit -s`, enforced in CI). Apache-2.0 gives an
express patent grant and contribution terms, which matters for a project whose
ranking and ML methods might otherwise attract patent questions, while staying
embeddable in commercial apps. MIT was the alternative: shorter, equally
permissive, but without the patent language. A CLA would preserve the ability to
relicense, but it deters first-time contributors and the project has no
commercial relicensing plan, so DCO was chosen instead. This decision is
expensive to reverse once outside contributions exist, which is why it is
recorded before the first merge.
