using System;
using System.Runtime.InteropServices;
using System.Threading;

class Program
{
    [DllImport("user32.dll")]
    static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);

    const byte VK_LWIN = 0x5B;
    const byte VK_H = 0x48;
    const uint KEYEVENTF_KEYUP = 0x0002;

    static void Main()
    {
        Thread.Sleep(50);
        keybd_event(VK_LWIN, 0, 0, 0);
        keybd_event(VK_H, 0, 0, 0);
        Thread.Sleep(50);
        keybd_event(VK_H, 0, KEYEVENTF_KEYUP, 0);
        keybd_event(VK_LWIN, 0, KEYEVENTF_KEYUP, 0);
    }
}
