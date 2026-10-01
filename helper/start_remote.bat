@echo off
rem Starts the CTPG remote (GO LIVE button link) in the background. Safe to run twice: a second copy just also connects.
start "" pythonw "C:\StreamerBot\ctpg-pack\remote\ctpg_remote.py"
