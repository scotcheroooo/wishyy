# Gift List Website

This is a birthday and Christmas gift list website. It uses Firebase so the gift list can be shared across devices.

## What is done

- Visitors can make a simple account with name, relation, and PIN.
- Returning visitors can enter their PIN.
- Visitor PINs are stored as one-way fingerprints, not plain PIN numbers.
- Gifts can be searched and sorted.
- Product names open the buying link.
- Bought gifts are crossed out and their buying links are removed.
- Owner tools use Firebase email/password sign-in.
- Owner tools can add gifts and update the current interests note.
- Firebase support is wired in.

## Important

Before sharing the real site, publish the Realtime Database rules and use the owner login once to initialize the shared list.

## Next setup step

Add to projects on main site (once done)
Add undo bought to any item from dev panel 
Add private family codes so you can see all lists in a family and go to peoples lists. 
On the login screen add a text box under PIN where you can put in a family code to go to that family’s page and see others lists or create your own list 
When creating your own list you put an email and password in to log into the owner tools on that list only
Remove relation to me textbox and make it so you're asked your relation to whoever's list you click on (so if you clicked on james’ list you'd be asked what your relation to james is and it would be set for that list specifically and remember it for that list and not other lists.)
Delete the ability to delete accounts from owner tools panel
Add the ability to make a family (creates a family page for all the lists in that family and the family code (which will be a 4 character code consisting of 4 random capital letters and numbers) for other people to see or make lists)
Add list names when you create a list you can give it a name (default is _____’s list or ______’ list)
Add dark/light mode switch on the top 
Add themes for dark or light mode and if your on dark mode it only shows dark mode themes and vice versa for light
Make it so the quick note and the interest note can be edited or deleted
When adding a gift make an option that is optional but its a scale on how much you want the item 1-10 slider 10 being most wanted 1 being least
Adding a sort option to sort by how much they want it with the 10 level wants being first 1 level wants being last
 Import custom theme
Instead of just calling it giftlist im gonna name it ~wishy whimsy~ and change the site to wishy.scotch.quest
Give it a better font (changes with some themes)
Make the default theme kinda fairy like with nature colours and like pink to make it match the name
Make it so i can see and manage every individual user, every family, every list, and with managing every user make it so i can see their PIN, the families their in, all their lists and theyre owner logins for their lists (from the invis dev account WHILE still having their pins be hashed if not then i still want to be able to see the pin just dont has ig)
Affiliate buying so you dont have to mark what you bought
Make it so you will only stay logged into the owner tools for 24 hrs (if i log into the owner panel i will have to log back into my owner panel)
Make sure that each owner log in can only log in to their designated list
Display the family code on the family homepage along with the people in the family
Ability to set a family admin who can edit the familys name the layout of the lists
If your the owner of a list or the family admin you can delete UR list (if your a family admin you can delete any list if necessary) 
Can export (onto the host computer) or import a list and all its info
When making a family you can: name it, add a description and has a default disclaimer that says “All of the lists in this family could have items on them that do not link to big sellers, companies, or brands like Amazon, Walmart, or Etsy. The responsibility is upon the owner of the list to view, examine, and determine if the links are safe to buy from. Any issues that come about from the used links do not fall back to the developer of the site”
When you click the plus button to make a new list it asks you for the name of the list (which it says is recommended to have your name in the list title), your email, and your password for the owner panel
In the owner panel if you scroll all the way down you'll see a delete list button that pops up with an “are you sure” popup that makes you enter the name of the list and your owner tools password to delete it
Make an invisible dev account with the name “dev” the relation to anybody will always be “website developer” and the pin will be  “162201” and when you log into the dev account with like the pin and the family code “DEV403” (which is the only exception to the 4 char family code rule) it pops up with the dev console where you can do anything like manage families, manage all user accounts, delete any families, delete any user accounts go to any family without being counted as a member of the family and without showing up in the family admin panel, being able to go see any list without the list owner seeing the account in the owner tools panel, delete items from lists it visits, change ANYBODY’S account info including the invis dev account, add or remove themes, and do ANYTHING that can be done making it the all powerful dev account for me
Add a copyright thing at the very bottom of the page that says “© 2026 Butterscotch Development. All rights reserved.”

