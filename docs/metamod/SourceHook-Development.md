# SourceHook Development - AlliedModders Wiki
SourceHook is a powerful API (Application Programming Interface) for detouring (hooking) virtual functions. Unlike static detours, SourceHook needs only to swap addresses in and out of an object's virtual table. This makes it fast and generally very platform-safe.

SourceHook is coupled with Don Clugston's [FastDelegate](http://www.codeproject.com/cpp/FastDelegate.asp) headers. Virtual hooks can be detoured to any static function of the same prototype, or any member function (of any class) as long as the prototype matches.

All code in SourceHook is part of the SourceHook namespace. Thus, it may be prudent to declare this before using SourceHook structures or types:

```
using namespace SourceHook;
```


Contents
--------

*   [1 Simple Hooks](#Simple_Hooks)
    *   [1.1 Declaration](#Declaration)
    *   [1.2 Getting an Interface Instance](#Getting_an_Interface_Instance)
    *   [1.3 Hook Functions](#Hook_Functions)
    *   [1.4 Adding Hooks](#Adding_Hooks)
*   [2 Manual Hooks](#Manual_Hooks)
    *   [2.1 Declaration](#Declaration_2)
    *   [2.2 Reconfiguring](#Reconfiguring)
    *   [2.3 Adding Hooks](#Adding_Hooks_2)
*   [3 Extended Removal Syntax](#Extended_Removal_Syntax)
*   [4 Old Macros](#Old_Macros)
*   [5 Global Hooks](#Global_Hooks)
    *   [5.1 Simple Hooks](#Simple_Hooks_2)
    *   [5.2 Manual Hooks](#Manual_Hooks_2)
*   [6 Modifying Parameters](#Modifying_Parameters)
    *   [6.1 Simple Hooks](#Simple_Hooks_3)
    *   [6.2 Manual Hooks](#Manual_Hooks_3)
*   [7 Bypassing Hooks](#Bypassing_Hooks)
    *   [7.1 Deprecated Syntax](#Deprecated_Syntax)
*   [8 Other Macros](#Other_Macros)
    *   [8.1 Interface Pointers from Hooks](#Interface_Pointers_from_Hooks)
    *   [8.2 Ignoring Reference Returns](#Ignoring_Reference_Returns)
*   [9 Automatic hookmanager generation](#Automatic_hookmanager_generation)

Simple Hooks
------------

SourceHook has the following steps of operation:

*   Declare the prototype of the function you are going to hook. This generates compile-time code that is able to pinpoint exactly how to go about hooking the function.
*   Hook the function - as a member function of another class or a regular static function.
*   Before the hooked function is called, all of the "pre" hook handlers attached to it are called. Each hook can set a special flag, the highest of which is chosen as a final operation. This flag specifies whether the original function should be called or not.
*   Once all the hooks have been called, SourceHook decides whether to call the original function. Another set of hooks are called directly after, called "post" hook handlers. You can specify whether each hook is a post or pre hook - it simply changes whether it's called before or after the original call is made.
*   After you are done using a hook, you must safely remove it before the object is destroyed (otherwise, memory will be leaked).

Declaration
-----------

As an example, take the following class prototype:

```
class IVEngineServer
{
public:
   /*...*/
   virtual void LogPrint( const char *msg ) = 0;
   virtual bool IsDedicated() = 0;
};
 
extern IVEngineServer *engine;
```


  
The first step is to figure out how to declare its prototype to SourceHook. This function is void, and has one parameter. The declaration macro follows these formats:

*   **SH\_DECL\_HOOK**n - n is the number of parameters
    *   The parameters are: Class name, member function name, attributes, overloaded?, the return type, and a list of the parameter types.
*   **SH\_DECL\_HOOKn\_void** - n is the number of parameters
    *   \_void specifies that the function does not return a value. The format is the same as above except the "return type" parameter is missing.
*   **Note:** Not covered here are the SH\_DECL\_HOOKn\[\_void\]\_vafmt hooks. These can hook string-formattable variable argument lists. You do not pass the string format or ellipses parameter. SourceHook will automatically format the string for your hook.

Our macro will look like this:

```
SH_DECL_HOOK1_void(IVEngineServer, LogPrint, SH_NOATTRIB, 0, const char *);
SH_DECL_HOOK0(IVEngineServer, IsDedicated, SH_NOATTRIB, 0, bool);

```


Broken down for the first line:

*   There is 1 parameter.
*   The function has no return value.
*   IVEngineServer is the class containing the function.
*   LogPrint is the function being hooked.
*   The function as no attributes (for example, it is not const).
*   The function is not overloaded.
*   The first (and only) argument is a const char \*

The second line is similar, except the parameter immediately after the overload parameter specifies the return type. There are no further parameters since it was declared with 0.

Getting an Interface Instance
-----------------------------

Before you can use an interface, you need to retrieve an instance of it. This is done with either the GET\_V\_IFACE\_ANY or GET\_V\_IFACE\_CURRENT macros. Both take the same arguments. GET\_V\_IFACE\_CURRENT is recommended if it works. GET\_V\_IFACE\_ANY should also work, but may be missing newer functionality.

Normally this initialization needs to be done when your MM:S plugin or SourceMod Extension starts.

You also need to know which factory produces the interface you need. There are only 4 factories: GetEngineFactory, GetServerFactory, GetPhysicsFactory, and GetFilesystemFactory. Normally you'll want Engine or Server.

You'll also need to know the constant that the game uses for that particular class. This is usually found in the hl2sdk for your game. In the case of IVEngineServer, this is INTERFACEVERSION\_VENGINESERVER located in public/eiface.h.

So, to retrieve the Interface so you can do something with it, it'd look something like this:

```
IVEngineServer *engine;

// For SourceMod, use the first signature
//bool MyExtension::OnMetamodLoad(ISmmAPI *ismm, char *error, size_t maxlen, bool late)
bool MyPlugin::Load(PluginId id, ISmmAPI *ismm, char *error, size_t maxlen, bool late)
{
    GET_V_IFACE_CURRENT(GetEngineFactory, engine, IVEngineServer, INTERFACEVERSION_VENGINESERVER);
}

```


The error and maxlen arguments **must** be named error and maxlen respectively, or else certain macros will fail.

Note that MyPlugin should be replaced with your plugin's class.

Hook Functions
--------------

Hooks can be declared either _pre_ or _post_. A _pre_ hook will intercept the original function before it is called. Pre-hooks can return one of four _hook actions_:

*   MRES\_IGNORED - The original function will be called.
*   MRES\_HANDLED - Same as MRES\_IGNORED, except subsequent hooks can assume this means something important was changed.
*   MRES\_OVERRIDE - The original function will be called, but the new return value will be used instead of the one from the original function.
*   MRES\_SUPERCEDE - The original function will not be called. The new return value (if any) will be used instead.

These enum constants are defined in <sourcehook.h>, and are made available to Metamod:Source plugin developers via <ISmmPlugin.h>.

Once all pre-hooks have been processed, SourceHook takes an action based on the "highest" hook action returned (MRES\_IGNORED being lowest, MRES\_SUPERCEDE being highest). Once the action has been processed, all _post_ hooks are called. That is to say, even if the original function is never called, post hooks are still processed. Because a post hook as no chance at true interception, it is important to realize that depending on the information being detoured, the data may be modified or destroyed. Similarly, a post hook's returned action and value is ignored.

A hook's action is signalled via one of two macros:

*   RETURN\_META - Only usable from void functions. Signals the action to take, then returns.
*   RETURN\_META\_VALUE - Only usable from non-void functions. Signals the action to take, then returns the supplied value.

There are two methods of adding or removing hooks. Hooks can be bound to **static** or **member** functions. Both have a similar syntax. Their macros are:

*   SH\_STATIC(Function) - Hook to a static function.
*   SH\_MEMBER(Instance, Function) - Hook to a member function.

**It is important to realize that a simple hook will only be invoked when used on the same instance.** That is to say, if there are 500 instances of object X, and a hook is added to function X::Y in instance #8, then the hook will only be invoked from instance #8. **Multiple hooks can be declared on the same instance, and multiple instances can be bound to the same hook, but one hook will only be invoked for the instances it was hooked to.**

To have hooks that work across all instances, and thus do not need to be delegated per-instance, see the "Global Hooks" section. As of SourceHook v5, it is safe to remove hooks on a destroyed instance, as the instance is not actually dereferenced. However, its virtual table must still be accessible.

Adding Hooks
------------

The macro to add hooks is SH\_\[ADD|REMOVE\]\_HOOK. The syntax is:

```
SH_[ADD|REMOVE]_HOOK(Interface, Function, Instance, Hook, [post? true,false])
```


An example of adding a LogPrint hook:

```
void Hook_LogPrint(const char *msg)
{
   if (strcmp(msg, "If this string matches the function will be blocked") == 0)
   {
      RETURN_META(MRES_SUPERCEDE);
   }
 
   /* Not needed, but good style */
   RETURN_META(MRES_IGNORED);
}
 
void StartHooks()
{
   log_hook = SH_ADD_HOOK(IVEngineServer, LogPrint, engine, SH_STATIC(Hook_LogPrint), false);
}
 
void StopHooks()
{
   SH_REMOVE_HOOK(IVEngineServer, LogPrint, engine, SH_STATIC(Hook_LogPrint), false);
}
```


The syntax is similar for hooking to member functions. Example equivalent to the above:

```
class MyHooks
{
public:
   void Hook_LogPrint(const char *msg)
   {
      if (strcmp(msg, "If this string matches the function will be blocked") == 0)
      {
         RETURN_META(MRES_SUPERCEDE);
      }
 
      /* Not needed, but good style */
      RETURN_META(MRES_IGNORED);
   }
 
   void StartHooks()
   {
      SH_ADD_HOOK(IVEngineServer, LogPrint, engine, SH_MEMBER(this, &MyHooks::Hook_LogPrint), false);
   }
 
   void StopHooks()
   {
      SH_REMOVE_HOOK(IVEngineServer, LogPrint, engine, SH_MEMBER(this, &MyHooks::Hook_LogPrint), false);
   }
};
```


Manual Hooks
------------

In some cases, it may be necessary to support multiple, incompatible ABI branches of an interface. For example, suppose you need to hook an application that may supply either version of these interfaces:

Interface v1:

```
class Interface
{
public:
   virtual void Function1() =0;
   virtual bool Function2(int clam) =0;
};
```


Interface v2:

```
class Interface
{
public:
   virtual bool Function2(int clam) =0;
};
```


Obviously, these two interfaces are backwards incompatible. Manual hooks allow you to precisely define the structure of the virtual table, bypassing the compiler's rules. These rules can be re-configured at runtime.

Declaration
-----------

Declaring a manual hook is similar to declaring a normal/simple hook. The syntax is:

```
SH_DECL_MANUALHOOK<n>[_void](UniqueName, vtblIndex, vtblOffs, thisOffs, [return and param types])
```


The UniqueName is a unique identifier for the hook. The vtblIndex is the index into the virtual table at which the function lies. In most compilers, this index starts from 0. The vtblOffs and thisOffs fields are used for multiple inheritance and are almost always 0 in modern compiler single inheritance.

An example of hooking the two functions from the first interface version:

```
SH_DECL_MANUALHOOK0_void(MHook_Function1, 0, 0, 0);
SH_DECL_MANUALHOOK1(MHook_Function2, 1, 0, 0, bool, int);
```


Reconfiguring
-------------

A manual hook can be _reconfigured_, which will update its set offsets. Reconfiguration automatically removes all hooks on the manual hook. Let's say we want to reconfigure the Function2 hook in the case of the second version being detected:

```
void SwitchToNewerHooks()
{
   SH_MANUALHOOK_RECONFIGURE(MHook_Function2, 0, 0, 0);
}
```


Note that the hook was referenced by its unique identifier.

Adding Hooks
------------

Adding or removing hook binds is done via the following extra macros:

*   SH\_ADD\_MANUALHOOK
*   SH\_REMOVE\_MANUALHOOK

These work similar to the original functions. Example:

```
extern Interface *iface;
 
bool Hook_Function2(int clam)
{
   RETURN_META_VALUE(MRES_IGNORED, false);
}
 
void StartHooks()
{
   SH_ADD_MANUALHOOK(MHook_Function2, iface, SH_STATIC(Hook_Function2), false);
}
 
void StopHooks()
{
   SH_REMOVE_MANUALHOOK(MHook_Function2, iface, SH_STATIC(Hook_Function2), false);
}
```


Similarly, a member function version would use SH\_MEMBER instead.

Extended Removal Syntax
-----------------------

The syntax described in the above sections is new as of SourceHook v4.5. SH\_REMOVE\_HOOK is, for all intents and purposes, optional. There is another way to remove hooks.

Each SH\_ADD macro returns a non-zero int on success. The same integer can be passed to the SH\_REMOVE\_HOOK\_ID macro, and the hook will be removed. This alternate removal syntax can simplify code that uses multiple successive or dynamic hooks.

Global hooks, described in a later section, require usage of SH\_REMOVE\_HOOK\_ID - that is, there is no helper macro to simplify removing a global hook.

Old Macros
----------

SourceHook v5.0 deprecates older macros that were used in earlier versions. The macros are:

*   SH\_ADD\_HOOK\_STATICFUNC - Wrapper for SH\_ADD\_HOOK and SH\_STATIC.
*   SH\_REMOVE\_HOOK\_STATICFUNC - Wrapper for SH\_REMOVE\_HOOK and SH\_STATIC.
*   SH\_ADD\_HOOK\_MEMFUNC - Wrapper for SH\_ADD\_HOOK and SH\_MEMBER.
*   SH\_REMOVE\_HOOK\_MEMFUNC - Wrapper for SH\_REMOVE\_HOOK and SH\_MEMBER.
*   SH\_ADD\_MANUALHOOK\_STATICFUNC - Wrapper for SH\_ADD\_MANUALHOOK and SH\_STATIC.
*   SH\_REMOVE\_MANUALHOOK\_STATICFUNC - Wrapper for SH\_REMOVE\_MANUALHOOK and SH\_STATIC.
*   SH\_ADD\_MANUALHOOK\_MEMFUNC - Wrapper for SH\_ADD\_MANUALHOOK and SH\_MEMBER.
*   SH\_REMOVE\_MANUALHOOK\_MEMFUNC - Wrapper for SH\_REMOVE\_MANUALHOOK and SH\_MEMBER.

These macros are fairly self explanatory. The parameter where the SH\_STATIC or SH\_MEMBER macro would normally go is instead filled with the parameters to that macro.

This syntax is considered deprecated, but it is still supported. Code written with these macros will continue to compile against older SourceHook versions. If you are writing a plugin which must work against Metamod:Source 1.4 and 1.6, you will want to use the older macros for simplicity.

Global Hooks
------------

**Note:** Global Hooks are only available in SourceHook v4.5 or later.

Global hooks are unlike normal hooks in that the hook is invoked for ALL instances, rather than solely the given the instance the hook was bound to. It is important to realize that this feature can be deceiving. Consider the following example:

```
class CBaseEntity
{
public:
   virtual void SetHealth(int health) =0;
};
 
class CBaseCat : public CBaseEntity
{
public:
   virtual void SetHealth();
};
 
class CBaseKitten : public CBaseCat
{
public:
   virtual void SetHealth();
};
```


In this example, CBaseCat and CBaseKitten instances have _separate virtual tables_. Although they both derive from CBaseEntity, they are separate virtual objects. **Therefore, a global hook on CBaseEntity will receive no invocations, and a hook on CBaseCat will receive only CBaseCat instances, as long as the instance is not a class derived from CBaseCat**.

With this understanding in place, there are two separate syntaxes - one for simple hooks and one for manual hooks. Additionally, there are two ways of declaring the virtual interface to use:

*   An instance of the class can be passed.
*   The direct address to the virtual table can be passed.

They are essentially equivalent, although one may be more advantageous than the other (for example, if no instances are known, but the vtable address can be extracted via pattern searching).

It is also important to note that global hooks are just a different method of "filtering." They fall into either the "simple" or "manual" category, and are otherwise exactly the same to those hooks. Thus there are no separate return/declaration macros for global hooks.

The macro META\_IFACEPTR is especially useful for global hooks. See [Interface Pointers from Hooks](about:/SourceHook_Development#Interface_Pointers_from_Hooks "SourceHook Development") near the end.

Lastly, global hooks exclusively use the extended hooking syntax. That means there exists only SH\_ADD macros. SH\_HOOK\_REMOVE\_ID must be used and the hook ID generated via SH\_ADD must be cached.

All examples will use the following code as a basis:

```
class Player
{
public:
   virtual void TakeDamage(int damage) =0;
};
 
void Hook_TakeDamage(int damage);
```


Simple Hooks
------------

Two extra macros exist for adding a global hook:

```
SH_ADD_VPHOOK(Interface, Function, Instance, Handler, Post)
SH_ADD_DVPHOOK(Interface, Function, VirtualTable, Handler, Post)
```


An example:

```
extern void *player_vtable;
HookId takedamage_hook = 0;
 
void StartHooks()
{
   takedamage_hook = SH_ADD_DVPHOOK(Player, TakeDamage, player_vtable, SH_STATIC(Hook_TakeDamage), false);
}
 
void StopHooks()
{
   if (takedamage_hook)
   {
      SH_REMOVE_HOOK_ID(takedamage_hook);
   }
}
```


Manual Hooks
------------

Similarly, manual hooks are straightforward:

```
SH_DECL_MANUALHOOK1_void(MHook_TakeDamage, 0, 0, 0, int);
 
extern void *player_vtable;
int takedamage_hook = 0;
 
void StartHooks()
{
   takedamage_hook = SH_ADD_MANUALDVPHOOK(MHook_TakeDamage, player_vtable, SH_STATIC(Hook_TakeDamage), false);
}
 
void StopHooks()
{
   if (takedamage_hook)
   {
      SH_REMOVE_HOOK_ID(takedamage_hook);
   }
}
```


Modifying Parameters
--------------------

Consider another variation of the hooking process. There is a hook on function X, which has one parameter. The hook wants to change the value of this parameter transparently. For example:

*   Caller passes 5 into X.
*   Hook changes the 5 to a 6.
*   Hooked function receives a 6 and continues normally.

SourceHook has a method for achieving this. As an added bonus, the new parameters are passed to subsequent hooks. That means the replacement process is as transparent as possible. For this example, we'll use the following code, with an assumed hook on Player::TakeDamage to the Hook\_TakeDamage function.

```
class Player
{
public:
   virtual void TakeDamage(int damage);
};
 
void Hook_TakeDamage(int damage);
```


Our objective is to multiply the damage by 2.

Simple Hooks
------------

For simple hooks, changing parameters looks similar to an SH\_CALL. The macros are:

```
RETURN_META_NEWPARAMS(Action, HookFunction, ([params]))
RETURN_META_VALUE_NEWPARAMS(Action, Value, HookFunction, ([params]))
```


Example:

```
void Hook_TakeDamage(int damage)
{
   RETURN_META_NEWPARAMS(MRES_IGNORED, &Player::TakeDamage, (damage * 2));
}
```


Note that the parenthesis enclosing the parameters are required.

Manual Hooks
------------

Manual hooks require slightly different macros. They are:

```
RETURN_META_MNEWPARAMS(Action, UniqueName, ([params]));
RETURN_META_VALUE_MNEWPARAMS(Action, Value, UniqueName, ([params]));
```


Example:

```
SH_DECL_MANUALHOOK1_void(MHook_Player_TakeDamage, 0, 0, 0, int);
 
void Hook_TakeDamage(int damage)
{
   RETURN_META_MNEWPARAMS(MRES_IGNORED, MHook_Player_TakeDamage, (damage *2));
}
```


Note that the parenthesis enclosing the parameters are required.

Bypassing Hooks
---------------

Often, either to avoid certain functionality or to avoid infinite recursion, it is necessary to bypass all hooks on a hooked function, such that only the original function is called. For instance, a previous blocked certain messages sent through LogPrint. In order to send that message, the hook needs to be bypassed.

To way to do this is to use the SH\_CALL macro:

```
SH_CALL(Instance, HookFunction)(params)
```


Example:

```
SH_CALL(engine, &IVEngineServer::LogPrint)("Secret Message");
```


Similarly, manual hooks have SH\_MCALL:

```
SH_DECL_MANUALHOOK1(MHook_Function2, 1, 0, 0, bool, int);
 
bool Function2_Bypass(int clam)
{
   return SH_MCALL(iface, MHook_Function2)(clam);
}
```


Deprecated Syntax
-----------------

The syntax described above is used in SourceHook v5.0 and v4.5. An older syntax, using a "CallClass" data type, was used in SourceHook v4.4 and lower. This syntax was deprecated in v4.5 and completely removed in v5.0. Upgrading from SourceHook v4.4 means that code referencing SH\_GET\_CALLCLASS or SH\_REMOVE\_CALLCLASS must be removed, and SH\_CALL simply needs an instance pointer instead.

Other Macros
------------

SourceHook contains a large variety of extra macros. This section is a grab bag of the more commonly used ones.

Interface Pointers from Hooks
-----------------------------

Let's say you have the following hook:

```
class Player
{
public:
   virtual void TakeDamage(int damage);
   float GetDamageModifier();
};
 
void Hook_TakeDamage(int damage);
```


How can you get the Player instance while in the hook? This can be achieved via the META\_IFACEPTR macro. Example:

```
void Hook_TakeDamage(int damage)
{
   Player *pPlayer = META_IFACEPTR(Player);
 
   int new_damage = (int)((pPlayer->GetDamageModifier() + 0.3) * (float)damage);
 
   RETURN_META_NEWPARAMS(MRES_IGNORED, &Player::TakeDamage, (new_damage));
}
```


Note that the class name should be passed to META\_IFACEPTR, not the pointer type.

Ignoring Reference Returns
--------------------------

There is a special macro, RETURN\_META\_NOREF, for ignoring a return value for reference-returning functions. Example:

```
class ISomething
{
public:  
   virtual int & GetSomething() =0;
};
 
int & Hook_GetSomething()
{
   RETURN_META_NOREF(MRES_IGNORED, int &);
}
```


Automatic hookmanager generation
--------------------------------

Normally, the SH\_DECL\_ macros generate a so-called "hook manager", a function which is invoked instead of the original function and then calls the hooks and processes their return and META\_RES values.

It is also possible to let SourceHook auto-generate the hook manager. This is neccessary if the function prototype is unknown at compile time (for example if hooks can be defined from third-party plugins of your plugin).

Example Usage from a Metamod:Source plugin:

```
#include "sourcehook_pibuilder.h"
 
// We want to hook a void (int, float) function
 
// Request IHookManagerAutoGen interface
SourceHook::IHookManagerAutoGen *hmag =
    static_cast<SourceHook::IHookManagerAutoGen *>(ismm->MetaFactory(MMIFACE_SH_HOOKMANAUTOGEN, NULL, NULL));
 
// (check for hmag == NULL)
 
// Build prototype information (using CProtoInfoBuilder helper class).
SourceHook::CProtoInfoBuilder protoInfo(SourceHook::ProtoInfo::CallConv_ThisCall);
protoInfo.AddParam(sizeof(int), SourceHook::PassInfo::PassType_Basic, SourceHook::PassInfo::PassFlag_ByVal,
    NULL, NULL, NULL, NULL);
protoInfo.AddParam(sizeof(float), SourceHook::PassInfo::PassType_Float, SourceHook::PassInfo::PassFlag_ByVal,
    NULL, NULL, NULL, NULL);
 
// Generate the hook manager
HookManagerPubFunc generatedHookMan = hmag->MakeHookMan(protoInfo, 0 /* vtable offset */, 0 /* vtable index */);
 
// Add the hook
int hookid = g_SHPtr->AddHook(g_PLID, SourceHook::ISourceHook::Hook_Normal/Hook_VP/Hook_DVP, iface_ptr, thisptr_offs,
    generatedHookMan, handler, post);
 
// ... (use the hook)
 
// After you're done using the hook (cleanup)
// Remove the hook
g_SHPtr->RemoveHookByID(hookid);
 
// Release hook manager
hmag->ReleaseHookMan(generatedHookMan);
```


CProtoInfoBuilder::AddParam has 7 parameters:

*   size: size of the type. This is sizeof(type) even if it is passed by reference!
*   passtype: this can be PassType\_Basic for integer types (char/short/int/...), PassType\_Float for floating-point types (float/double) and PassType\_Object for unions, structs and classes.
*   passflags: flags. Has to contain either PassFlag\_ByVal or PassFlag\_ByRef.
*   pNormalCtor: for PassType\_Object, set this to the pointer to the user-defined default constructor of the object, if it has one.
*   pCCtor: for PassType\_Object, set this to the pointer to the user-defined copy constructor of the object, if it has one.
*   pODtor: for PassType\_Object, set this to the pointer to the user-defined destructor of the object, if it has one.
*   pAssignOperator: for PassType\_Object, set this to the pointer to the user-defined assignment operator of the object, if it has one.

If you are hooking a non-void function, also call CProtoInfoBuilder::SetReturnType. It has the same arguments as AddParam.

The handler parameter of ISourceHook::AddHook is a pointer to the ISHDelegate interface. In C++, you construct ISHDelegates like this:

```
class MyDelegate : public SourceHook::ISHDelegate
{
public:
    // vtable index 0
    virtual bool IsEqual(ISHDelegate *pOtherDeleg)
    {
        // pOtherDeleg is guaranteed to be from the same plugin.
        // This function is only used for compat with the old SH_REMOVE_HOOK method.
        // if you don't want to use that with your hooks, you can simply return false here.
        // if for some reason you need it, a good idea could be comparing the vtable pointer:
        return *reinterpret_cast<void**>(this) == *reinterpret_cast<void**>(pOtherDeleg);
 
        // But in general I'd just return false!
    }
 
    // vtable index 1
    virtual void DeleteThis()
    {
        delete this;   // Called from SourceHook when this instance is not needed
                       // and should be deleted.
    }
 
    // vtable index 2
    virtual ret_type Call(params)
    {
        // your code.
        // SH_DECL_ macros pass execution to the actual user's handler through a FastDelegate
        // which is stored as a member variable of the delegate class.
    }
};
```


The first parameter of the CProtoInfoBuilder constructor (see example code above) is the calling convention in an extended sense. At the moment it can be either CallConv\_ThisCall or (CallConv\_ThisCall | CallConv\_HasVafmt). The second value means that the function has printf-like string formatting. Then, the finaly _const char \*, ..._ arguments will be added automatically, and the Deleagte::Call method should have one more parameter: _const char \*formattedString_.

pNormalCtor/pCCtor/pODtor/pAssignOperator should be found using offsets / sigscanning. If you are a C++ plugin and know the type at compile time, you can also use the following class:

```
// Address of constructor/destructor
// (using wrappers)
template <class T>
class Ctor_Thunk
{
public:
	void NormalConstructor()
	{
		new(this) T;
	}
 
	void CopyConstructor(const T &other)
	{
		new(this) T(other);
	}
 
	void Destructor()
	{
		reinterpret_cast<T*>(this)->~T();
	}
 
	const T& AssignOp(const T &other)
	{
		return (*reinterpret_cast<T*>(this) = other);
	}
};
 
 
template <class T>
void *FindFuncAddr(T mfp)
{
	union
	{
		T a;
		void *b;
	} u;
	u.a = mfp;
	return u.b;
}
 
// Usage:
FindFuncAddr(&Ctor_Thunk<type>::NormalConstructor)
// (if the type is a reference type, use it without & here)
```
