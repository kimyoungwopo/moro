# Looping: make reset part of the design

A CreatorProject has no `loop` flag. Repetition belongs to the player/wrapper; do not add undeclared project fields. Event feedback should normally stop on its confirmed pose. The success example is intentionally not cyclic.

For a loop with N frames:
1. Write start→action→settle→hold→reset phases. Set every animated property's value at N−1 equal to frame 0. If a property stays static, leave it static.
2. Plan the approach to both endpoints. Equality prevents a pose jump, not a velocity discontinuity. Quiet endpoint holds make seam inspection simpler; continuous rotation needs a separately tested wrap strategy, not blind 0→360 equality claims.
3. Hide or soften reset only deliberately. An opacity-0 reset still needs matching geometry endpoints, and must not leave a flash when the player wraps.
4. Seek N−3, N−2, N−1, 0, 1, 2 and play several wraps in the real exported player. Check neighboring motion and perceived dwell, not just numbers.

The loader returns each dot to rest before a shared quiet seam. The product scene resets its moving subject while invisible, then reveals it at the initial position; its supporting surfaces remain static. Every animated endpoint matches. Endpoint holds add dwell and can look stalled—shorten them only after inspecting the seam.

Completion: compare exported and creator poses at both ends; inspect wrap in motion. For reduced motion, present one intentionally chosen still and disable autoplay/repetition in the host.
