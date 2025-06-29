# Ngedrop!

[muchad.com/drop](https://muchad.com/drop): Send text and share files with anyone nearby on the same Wi-Fi. 


This project began as a modified version of the excellent open-source [neardrop](https://github.com/omniashare/neardrop), which itself is based on the original [snapdrop](https://github.com/snapdrop/snapdrop). 


### Key Enhancements
While preserving the core features of its predecessors, this version introduces several upgrades:

* **🚀 Robust Connection Stability**: Replaced the manual application-level ping/pong with a low-level WebSocket heartbeat mechanism. This drastically reduces "ghost peers" and accurately detects abrupt disconnects, a common issue on mobile devices.

* **⚡️ Always-On Service**: Implemented a `/ping` health-check endpoint that works with a cron job to keep the free-tier service on free web server alive and prevent it from sleeping.
