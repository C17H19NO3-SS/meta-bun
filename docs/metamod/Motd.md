# Motd (Metamod:Source) - AlliedModders Wiki
Contents
--------

*   [1 Message of the Day (MOTD)](#Message_of_the_Day_.28MOTD.29)
    *   [1.1 Showing a MOTD Panel](#Showing_a_MOTD_Panel)
    *   [1.2 Displaying Your Info in the MOTD Panel](#Displaying_Your_Info_in_the_MOTD_Panel)
*   [2 Using TYPE\_INDEX to Send More Than 255 Characters](#Using_TYPE_INDEX_to_Send_More_Than_255_Characters)

Message of the Day (MOTD)
-------------------------

### Showing a MOTD Panel

To show a MOTD, you'll need to add this code to your project. You'll also need to include an [MRecipientFilter](https://wiki.alliedmods.net/MRecipientFilter "MRecipientFilter") class. You may want to make it part of a class instance in your program, but this will work as an example.

First add this to AllPluginsLoaded:

```
mVGUIMenu = UserMessageIndex("VGUIMenu");
```


Then add this to your project:

```
void ShowMOTD(int index, char *title, char *msg, int type, char *cmd) {
   bf_write *buffer;
   MRecipientFilter filter;
 
   filter.AddRecipient(index);
 
   buffer = engine->UserMessageBegin(&filter, mVGUIMenu);
   buffer->WriteString("info");
   buffer->WriteByte(1);
 
   if(cmd != NULL)
      buffer->WriteByte(4);
   else
      buffer->WriteByte(3);
 
   buffer->WriteString("title");
   buffer->WriteString(title);
 
   buffer->WriteString("type");
   switch(type) {
      case TYPE_TEXT:
         buffer->WriteString("0"); //TYPE_TEXT = 0, just display this plain text
         break;
 
      case TYPE_INDEX:
         buffer->WriteString("1"); //TYPE_INDEX, lookup text & title in stringtable
         break;
 
      case TYPE_URL:
         buffer->WriteString("2"); //TYPE_URL, show this URL
         break;
 
      case TYPE_FILE:
         buffer->WriteString("3"); //TYPE_FILE, show this local file
         break;
   }
 
   buffer->WriteString("msg");
   buffer->WriteString(msg); // msg must not be greater than 192 characters
 
   if(cmd != NULL) {
      buffer->WriteString("cmd");
      buffer->WriteString(cmd); // exec this command if panel closed
   }
 
   engine->MessageEnd();
   return ;
}
```


### Displaying Your Info in the MOTD Panel

The types of MOTD available are:

```
TYPE_TEXT = 0  // just display this plain text
TYPE_INDEX = 1 // lookup text & title in stringtable
TYPE_URL = 2   // show this URL
TYPE_FILE = 3  // show this local file
```


For example: To show a website

```
ShowMOTD( pEdict, "http://www.yahoo.com", "Yahoo.com !", TYPE_URL, NULL )
```


To show some text

```
ShowMOTD( pEdict, "Some Text", "A Title", TYPE_TEXT, NULL )
```


Using TYPE\_INDEX to Send More Than 255 Characters
--------------------------------------------------

TYPE\_TEXT is limited to 255 characters. To send a longer piece of info, we need to create an entry in the StringTables and reference that using TYPE\_INDEX.

First, we need to have a NetworkStringTableContainer:

```
INetworkStringTableContainer *m_NetworkStringtable;
```


Then, using the FIND\_IFACE macro from the sample\_mm plugin, we need to get the INetworkStringTable interface in Load():

```
	strcpy(iface_buffer, INTERFACENAME_NETWORKSTRINGTABLESERVER);
	FIND_IFACE(engineFactory, m_NetworkStringtable, num, iface_buffer, INetworkStringTableContainer *);
```


Next, we can setup our string table entry:

```
	char msg[4096];
	// copy your info into msg
	// if you add any html tags, your msg will be formatted as html (for example <b>bold text</b>)
 
	INetworkStringTable *pInfoPanel = m_NetworkStringtable->FindTable("InfoPanel");
	if (pInfoPanel)
	{
		bool save = m_Engine->LockNetworkStringTables(false);
		int StrIdx = pInfoPanel->AddString("myinfo");
		pInfoPanel->SetStringUserData(StrIdx, 4096, msg);
		m_Engine->LockNetworkStringTables(save);
	}
	}
```


NOTE: 4096 characters is the max length, you should use the smallest size that your string data will fit into.

Finally you can show the MOTD panel with the info you added to the string tables:

```
ShowMOTD( EntityIndex, "myinfo", "My MOTD Window Title", 1, "" );
```


NOTE: I've tested this using html formatted text. I assume that the maximum length for standard text would also be 4096 characters. --[L. Duke](https://wiki.alliedmods.net/User:L._Duke "User:L. Duke") 00:45, 18 March 2006 (EST)