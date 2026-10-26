@echo off
chcp 65001 > nul
echo.
echo  ╔══════════════════════════════════════╗
echo  ║      ExamFlow — ระบบข้อสอบออนไลน์   ║
echo  ╚══════════════════════════════════════╝
echo.
echo  กำลังเริ่มเซิร์ฟเวอร์ที่ port 3000...
echo  เปิดเบราว์เซอร์ที่: http://localhost:3000
echo.
echo  กด Ctrl+C เพื่อหยุด
echo.

:: เปิดเบราว์เซอร์หลังจาก 1 วินาที
start "" timeout /t 1 > nul
start "" "http://localhost:3000"

:: รัน Python server
python -m http.server 3000
