Dim sPath
sPath = WScript.Arguments(0)
Dim cat
Set cat = CreateObject("ADOX.Catalog")
cat.Create "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=" & sPath & ";"
Set cat = Nothing
WScript.Echo "OK"
