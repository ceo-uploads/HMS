# Current Version :
    Current Software Version = v1.0.4
# Update work needed now and final update verision of this software now :
    Final Work for Version = v1.0.5

## Update workflow :
    Updates are incoming will be markdown here, for every item and sections will be mentoioned and update requirements are very welly descrived in this markdown file.

## Cash Memo :
    (01) For the Generated Test slips as {Cash Memo} - There will be the Test Code before 
        the test name in the table.

## Counter -> New Test Section :
    (01) In the New Test Section layout inside the counter navigation. And there is the 
        Selection Panel for => {doctors ref} + {Marketing Agent} + {Special refer}. Those three selection options will have there image for sure (Beside there names for every items in the list).

    (02) For the selection panel in the new test bill, there will be more and more 
        Doctors/Marketing_Agents/Special Referrels , so everything doesnot need to appear at once, there will be a select bar only appear when clicked, and also have a type option to search by anything {then Select} there.

## Management Tab :
    (01) Inside the management Tab, there need to add a new section = {Room Bills} , which
        will be placed right before the {Dev-Tunnel} tab.

## Newly Create {Room Bills Tab} :
    (01) Highly designed floors and rooms, for each floor -> there will be the rooms.
    (02) Each Rooms Have Name (name + floor) , And Monthly Bill, Status => {Cleared / Due} 
        for the reamining Month and will automatically updated the due within the First day of each month.

    (03) there have manage_rooms sections to add any floor and rooms, also update any 
        information of the Floor and rooms.
        There will be the Claim Due / Received Payment Button which will generate a slip also and there will be the hostory / directory of previous claims. And this Button will only appear for any rooms with status = {Due}, and the amount received will be added in the total earning section, and in the archive section,, there will be the records of that,, and when receiving, the status will be pushed to live summery also.

        After Claiming a due, there will also be a slip generated for that. which will also be in A5 document size or less.

    (04) The grids for the Floor and Room will be in 3d and responsive representation. High 
        Quality designs will be there.

    (05) The Rooms database and the data related with it will be added inside the 
        Database->others.json . and 

## Analytics Section :
    (01) For 3d items in the analytics section, ad more cool animations there and make the
        3d UI ad immersive and very gorgious.

    (02) Add more and more analytics items there with high quality and controled UI 
        visuals. And also add more analytics funtionality and methods.

    (03) Upgrade the Visuals and animations for the existing analysis items, and give
        the user control for 3d items.

## Database :
    (01) This Software will operate every database (like CRUD) using only the json itself
        and everything will be updated live. The other assets also will be stored locally.

    (02) For Firebase Realtime Database (Only Firebase RTDB), the system will only push the data to RTDB.
        it will not retrieve the data from firebase.

## Firebase Ruleset :
    (01) The Software will use the database as Json only, but as the Same, it will only 
        push the new entry data for (Counter + Cabin) as the same format (only the test slip and the indoor billings) as the software does.
    
    (02) The Software will retrive the viewing the data from the local json database
        only, for the Firebase Realtime Database rule, the software will only push the data into the RTDB.

    (03) If the system has lost it internet connection (or even offline mode), the software
        will arrange the entries as a stack {Ready Queue} till the system internet connection restored, after the system has retrieved its internet connectivity - the software will then push the stack into the Firebase RTDB.

    (04) The RTDB analytics and other {every} analytics {Get} from firebase {firebase/
        google analytics} will be shown inside 
        the devtunnel in a new section item. And add more and more dev tunnel features there

## Firebase Data Distribution :
    (01) There will be Fpur firebase projects for using the RTDB => {Project-A} +  
        {Project-B} + {Project-C} + {Project-D}

    (02) These Three Project will work combinely for storing the Data of => {Clicnical Test}
        + {Cabin Bookings} + {Room Bill} and others.

    (03) Each Firebase Projects RTDB will store data in a well structured way that will
        be easy to retrieve later and have a good management. To save the storage and bandwidth also.

    (04) To see the data From the Firebase RTDB, there will be a website using html-css-js.
        You can see the files in the website_html directory.

    (05) Firebase Sdks for the four projects are listed inside the Firebase_sdks directory.
    (06) And there is a firebase.js file inside the firebase directory, which will operate
        the entire firebase initialization and projects with the software. And inside the website_html directory, there will be the initialization for firebase also there for the html website.

## Website :
    (01) Require Login (only Login) via gmail (continue with google).
    (02) Highly Stylished and beautifull UI, Rich Polish UI. And only for Android device
        Widths.
    
    (03) There will have navigation Items And will retrieve the data from the Firebase
        RTDB. The navigetion Items will be like => {Home - Dashboard} + {Live Summery} + Just Like Every Items which is available in the softwares archive & report section. This Website will only be for viewing and monitoring everything with the data from firebase (Pushed by the Software). This website will only read / monitor the data, cannot make any changes and cannot update anything.

    (04) There will also have the Search anything option + Sorting Options + And Scan 
        Option also (just like the software).


    (05) Also have the developer credit footer there.