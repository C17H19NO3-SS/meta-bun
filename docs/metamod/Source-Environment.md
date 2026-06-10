# Metamod:Source Environment - AlliedModders Wiki
This article explains how to set up your Windows or Linux environment to compile Metamod:Source's sample plugins.

This article does not guarantee that you will be able to build third-party plugins, which may have their own build environment requirements. However, it creates a baseline for making sure you can successfully build plugins.

**Note:** You can use Valve's HL2SDK source tree, but we have our own available. It fixes all of Valve's mistakes such that you can build on both GCC and Visual Studio with no warnings or errors.

**Note:** This article is intended to be used against Metamod:Source 1.7.

Contents
--------

*   [1 Requirements](#Requirements)
    *   [1.1 Windows](#Windows)
    *   [1.2 Linux](#Linux)
*   [2 Setup](#Setup)
    *   [2.1 Getting the Files](#Getting_the_Files)
    *   [2.2 Linux](#Linux_2)
    *   [2.3 Windows](#Windows_2)

Requirements
------------

Windows
-------

*   Microsoft Visual C++ 2008 (Express or higher) is supported and used for official builds.
*   Microsoft Visual C++ 2005 (Express or higher) is unsupported, though it should work as it is capable of building compatible binaries.
*   Microsoft Visual C++ 2003 7.1 is unsupported. It is capable of building compatible binaries against the original (non-Orange Box SDK) only.
*   Microsoft Visual C++ 2003 7.0 or lower **cannot** be used.

If you are installing Visual C++ 2005 Express, it may not come with Microsoft's Platform SDK installed. If this is the case, you must manually install the Platform SDK. You can find directions on how to do this and test your setup [here](http://www.microsoft.com/express/2005/platformsdk/default.aspx). According to Microsoft, Visual C++ 2008 "streamlines" the Platform SDK installation for you.

Linux
-----

For Linux, Metamod:Source requires the GNU C/C++ Compiler (from GCC):

*   Version 4.1 is used for official binaries and is guaranteed to build.
*   Versions 3.4 through 4.2 are guaranteed to be binary (ABI) compatible. Metamod:Source and its sample plugins will probably build fine on them.
*   Any GCC version below 3.4 **cannot** be used.

Setup
-----

Getting the Files
-----------------

This section describes which files you must have and how to get them. Do not worry about where to place them yet -- that will be discussed on a per-platform basis. You can download the files anywhere you'd like.

You can use the HL2SDK from Valve, but it's recommended you use the one linked to here. We have a patched version that fixes many compilation bugs and it will make your life easier on both operating systems. Link for [HLSDK changes](http://hg.alliedmods.net/hl2sdks/) located at bottom of Metamod:Source downloads page.

You need each SDK for each game you want to compile against (if your plugin requires knowledge about the game).

To get Metamod:Source files, visit [Metamod:Source downloads](http://www.metamodsource.net/?go=downloads). Make sure to get the source code and not the binaries.

Linux
-----

As of this writing, SourceMod's Makefiles are hardcoded to use a binary called "gcc-4.1" You can override this, for example:

```
make CPP=gcc
```


Otherwise, you can also just create a symlink:

```
sudo ln -s /usr/bin/gcc /usr/bin/gcc-4.1
```


Note that you must use gcc and not g++. Using g++ creates a libstdc++ dependency, which may interfere with Valve's libstdc++ usage and will cause platform portability problems in general. As a corollary you should avoid using STL, RTTI (Run-Time Type Information), or exceptions.

Metamod:Source's Makefiles have a strict directory organization. You must have a top-level folder. For this document, we'll assume it is called project, though it can be named anything. The layout of project should be:

*   project/
    *   mmsource-1.7 - symlink or folder containing Metamod:Source 1.7 source code
    *   hl2sdk - symlink or folder containing the HL2SDK for Episode 1
    *   hl2sdk-ob - symlink or folder containing the HL2SDK for Orange Box/TF
    *   hl2sdk-l4d - symlink or folder containing the HL2SDK for Left 4 Dead

If you are using a 64-bit version of Linux, you may need to install extra packages to be able to compile SourceMod. On Debian-based distros, these are typically:

```
#prerequisites
#apt-get install g++-4.1 gcc-4.1 make mercurial
#apt-get install libz libz-dev
#only needed if you want to use the build tool
#apt-get install mono mono-devel
#32-bit support
apt-get install ia32-libs
apt-get install lib32z1 lib32z1-dev
apt-get install libc6-dev-i386 libc6-i386

```


In your projects, you should use mmsource-1.7/core for the new (1.6+) API and mmsource-1.7/core-legacy for the legacy (1.4-) API, needed for compatibility with the original MM:S engine.

Windows
-------

On Windows, there is no particular directory layout required -- environment variables are used instead. The directions below apply to Windows XP, and are assumed to be similar for other versions of Windows.

*   Open the Control Panel (for example, via Start -> Settings).
*   Open the System control. If you don't see it, you may need to switch to "Classic view" (either via the left-hand pane or by going to Tools -> Folder Options).
*   Click the Advanced tab.
*   Click the Environment Variables button.

You can add your environment variables to either your User settings or your System settings. Create a new variable for each item in the list below. The item names are in fixed-width font and their value descriptions follow.

*   MMSOURCE18 - Path to Metamod:Source 1.8 source code.
*   HL2SDK - Path to HL2SDK for Ep1/Original
*   HL2SDKOB - Path to HL2SDK for Ep2/OrangeBox
*   HL2SDKL4D - Path to HL2SDK for Left 4 Dead

In your projects, you should use $(MMSOURCE18)/core for the new (1.6+) API and $(MMSOURCE18)/core-legacy for the legacy (1.4-) API, needed for compatibility with the original MM:S engine.