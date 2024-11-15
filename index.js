import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcryptjs";
import passport from "passport";
import { Strategy } from "passport-local";
import session from "express-session";
import env from "dotenv";
import GoogleStrategy from "passport-google-oauth2";


const app = express();
const port = 3000;
env.config();

app.use(
    session({
      secret: process.env.LOCAL_SECRET,
      resave: false,
      saveUninitialized: true,
    })
  );

const db = new pg.Client({
  user: process.env.USER_PG,
  password:  process.env.USER_PG_PASSWORD,
  host:  process.env.HOST_PG,
  port:  process.env.PORT_PG,
  database: process.env.DATABASE_PG 
});

let email;
let password;
let username;
let data;
let posts;
let confirmPassword;
let saltRounds = 10;
let createPost = false;
let editPost = false;
let editPostTitle;
let editPostText;
let postId

db.connect();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(passport.initialize());
app.use(passport.session());


app.get("/", (req, res) => {
    res.render("index.ejs");
 
});

app.get("/error", (req, res) => {
  let login_error = "Username or password is incorrect. Please try again.";
        res.render("index.ejs", {
            error_message: login_error
        });

});

app.get("/auth/google", passport.authenticate("google", {
  scope: ["profile", "email"],
})
);

app.get(
"/auth/google/login",
passport.authenticate("google", {
  successRedirect: "/login",
  failureRedirect: "/",
})
);

app.get("/login", async (req, res) => {
  // console.log(req.user);
  
  if (req.isAuthenticated()) {
  username = req.user.user_name;
  posts = await db.query(`SELECT * FROM ${username.toLowerCase()} ORDER BY id `)
    res.render("user.ejs",{
      data: req.user,
      posts: posts.rows,
      createPost: createPost,
      editPost: editPost,
      editPostTitle: editPostTitle,
      editPostText: editPostText,
      postId: postId

    });
  } else {
    console.log("error login in");
    res.redirect("/");
  }
});

app.post("/register", async (req, res) => {

    email = req.body["email"];
    password = req.body["password1"];
    confirmPassword = req.body["confirmPassword"]
    username = req.body["username1"];

    console.log(password);
    console.log(confirmPassword);

    
    data = await db.query("SELECT * FROM users WHERE user_name = $1", [username]);


    if(password !== confirmPassword){
        console.log("Passwords do not match!");
        let noMatch = "Passwords do not match!";
        res.render("index.ejs", {
            error_message: noMatch
        });
    }
    else if(data.rows[0] === undefined){

        bcrypt.hash(password, saltRounds, async (err, hash) => {

            await db.query(
                "INSERT INTO users (user_name, user_password, user_email) VALUES ($1, $2, $3)", 
                [username, hash, email]  
                );
        
                await db.query(`CREATE TABLE ${username} (id SERIAL PRIMARY KEY, post_title TEXT, posts TEXT, date TEXT)`);
        
                let message = "User created!";
        
                res.render("index.ejs", {
                    message: message
                });
        });    
    }
    else{
        console.log("Username already exists. Please think of another username!")
        let userTaken = "Username already exists. Please think of another username!";
        res.render("index.ejs", {
            error_message: userTaken
        });   
    }
});

app.post("/login", 

passport.authenticate("local", {
    successRedirect: "/login",
    failureRedirect: "/error",
    failureMessage: true,
  })

);

app.post('/logout', function(req, res, next) {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

app.post("/createPost", (req, res) => {
  createPost = true;
  res.redirect("/login");
})


app.post("/newPost", async (req, res) => {

    const date = new Date();
    const postDate = date.toLocaleString('en-GB', { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", timeZone: "Europe/Vilnius", timeZoneName: "short"});
    const title = req.body["postTitle"];
    const text = req.body["postText"];
    console.log(username);
  
    await db.query(`INSERT INTO ${username.toLowerCase()} (posts, post_title, date) VALUES ($1, $2, $3)`, [text, title, postDate]); 

    data = await db.query("SELECT * FROM users WHERE user_name = $1", [username]);
    posts = await db.query(`SELECT posts, post_title, date FROM ${username.toLowerCase()} ORDER BY id`);
  
    console.log(posts.rows);

    createPost = false;
    res.redirect("/login");  

});

app.post("/cancel", (req, res) => {
  createPost = false;
  editPost = false;
  res.redirect("/login")
})


app.post("/delete/:id", async (req, res) => {
      postId = req.params.id;
      console.log("post id: " + postId);
      await db.query(`DELETE FROM ${username.toLowerCase()} WHERE id = $1`, [postId]);
      res.redirect("/login");
});

app.post("/edit/:id", async (req, res) => {

      editPost = true;
      postId = req.params.id;
      console.log("post id: " + postId);
      let dataPostTitle = await db.query(`SELECT post_title FROM ${username.toLowerCase()} WHERE id = $1`, [postId]);
      let dataPostText = await db.query(`SELECT posts FROM ${username.toLowerCase()} WHERE id = $1`, [postId]);

      editPostTitle = dataPostTitle.rows[0].post_title
      editPostText = dataPostText.rows[0].posts

      res.redirect("/login");

     
});

    
app.post("/editPost", async (req, res) => {

    console.log("post id: " + postId);
    let newTitle = req.body["newPostTitle"];
    let newText = req.body["newPostText"];
    await db.query(`UPDATE ${username.toLowerCase()} SET post_title = $1, posts = $2 WHERE id = $3`, [newTitle, newText, postId])
    posts = await db.query(`SELECT id, posts, post_title, date FROM ${username.toLowerCase()} ORDER BY id`);
    editPost = false;
    res.redirect("/login"); 
  
});

app.post("/deleteAccount/:id", async (req, res) => {
  let Acc_name = req.params.id;
  console.log(Acc_name)
  await db.query(`DROP TABLE ${Acc_name.toLowerCase()}`)
  await db.query("DELETE FROM users WHERE user_name = $1", [Acc_name])
  console.log(Acc_name + "deleted")
  res.redirect("/")
});


passport.use(
  new Strategy(async function verify(username, password, cb) {
     try{
       const result = await db.query("SELECT * FROM users WHERE user_name = $1 ", [
         username]);
      
      if(result.rows[0] === undefined){
        return cb(null, false);
      }
      else{

          username = result.rows[0];
          const hashedPasswordCheck = result.rows[0].user_password;

          bcrypt.compare(password, hashedPasswordCheck, (err, valid) => {

              if (err) {
                  console.error("Error comparing passwords:", err);
                  return cb(err);
                } 
              else if(valid){
                  return cb(null, username);
              }
              else {
                  return cb(null, false);
                }
          
          })
      }
      }
      catch(err){
          console.log(err);
      }
}
));


passport.use(
  "google", 
  new GoogleStrategy(
  {

  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "https://mykolbook.onrender.com/auth/google/login",
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",

  },
  async (accessToken, refreshToken, profile, cb) => {
  
  username = profile.email.replace(/\W/ig, "");
  username = username.replace("gmail", "");
  username = username.replace("com", "");
  console.log(username)
  email = profile.email;
  
  data = await db.query("SELECT * FROM users WHERE user_name = $1", [username]);

  if(data.rows[0] === undefined){

    await db.query(
      "INSERT INTO users (user_name, user_password, user_email) VALUES ($1, $2, $3)", 
      [username, "google", email]  
      );

    await db.query(`CREATE TABLE ${username} (id SERIAL PRIMARY KEY, post_title TEXT, posts TEXT, date TEXT)`);

    username = await db.query("SELECT * FROM users WHERE user_name = $1", [username]);

    return cb(null, username.rows[0]);
    }
    else {
      return cb(null, data.rows[0]);
    }
  }
)
);
                
passport.serializeUser((user, cb) => {
  cb(null, user);
});
passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.listen(port, () => {
    console.log("Listening on port " + port);
});

