const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const app = express();
app.use(express.json());

dbPath = path.join(__dirname, "userData.db");

let db = null;

const initializeDBandServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("SERVER RUNNING SUCCESFULLY......");
    });
  } catch (e) {
    console.log(`DB ERROR ${e.message}`);
    process.exit(1);
  }
};

initializeDBandServer();

///JWT AUTHENTICATION
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};
///

//SIGNUP POST API
app.post("/signup", async (request, response) => {
  const { username, password } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT username FROM usertable WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO 
        usertable (username,password,createdAt) 
      VALUES 
        (
          '${username}', 
          '${hashedPassword}',
           date("now")
        )`;
    const dbResponse = await db.run(createUserQuery);
    const newUserId = dbResponse.lastID;
    response.status(200);
    response.send({ message: "user created", userId: newUserId });
  } else {
    response.status = 400;
    response.send({ message: "user already exits" });
  }
});
//

//LOGIN POST API

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM usertable WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send({ message: "Invalid User" });
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ userId: dbUser.userid, jwtToken: jwtToken });
    } else {
      response.status(400);
      response.send({ message: "Invalid Password" });
    }
  }
});

//SIGNUP GET API
app.get("/signup", (request, response) => {
  response.sendFile("pages/signup.html", { root: __dirname });
});
//LOGIN GET API
app.get("/login", (request, response) => {
  response.sendFile("pages/login.html", { root: __dirname });
});

//HOME API
app.get("/", (request, response) => {
  response.sendFile("pages/home.html", { root: __dirname });
});

//getAllNotes POST API
app.post("/getAllNotes", authenticateToken, async (request, response) => {
  const { userId } = request.body;
  getAllNotesQuery = `
            SELECT * 
            FROM 
                notesTable
            WHERE userid = ${userId};
  `;
  const allNotes = await db.all(getAllNotesQuery);
  response.send({ allNotes: allNotes });
});

//addNote POST API
app.post("/addNote", authenticateToken, async (request, response) => {
  const noteDetails = request.body;
  const { userId, desp, noteTitle } = noteDetails;
  const dt = new Date();

  const date =
    dt.getFullYear() + "/" + (dt.getMonth() + 1) + "/" + dt.getDate();
  addNoteQuery = `
  INSERT INTO notesTable (noteTitle,desp,userId,createdAt)
  VALUES('${noteTitle}','${desp}',${userId},'${date}')
  `;

  const addedNote = await db.run(addNoteQuery);
  response.send({ message: "Note Added" });
});

///DELETE NOTE API
app.delete("/", authenticateToken, async (request, response) => {
  const { noteTitle, desp, noteId, userId } = request.body;
  const dt = new Date();

  const date =
    dt.getFullYear() + "/" + (dt.getMonth() + 1) + "/" + dt.getDate();

  const deleteNoteQuery = `
                DELETE FROM notesTable 
                WHERE noteId = ${noteId}; 
  `;

  const deleteNoteFromRemainderQuery = `
                DELETE FROM remainderTable 
                WHERE noteId = ${noteId}; 
  `;
  const addToTrashQuery = `
        INSERT INTO trashTable(trashId,noteTitle,desc,userId,deletedAt)
        VALUES (${noteId},'${noteTitle}','${desp}',${userId},'${date}')
  `;
  const trashId = await db.run(addToTrashQuery);
  const deletedNoteId = await db.run(deleteNoteQuery);
  await db.run(deleteNoteFromRemainderQuery);
  console.log(trashId.lastID);
  response.send({ message: "Note Moved To Trash" });
});

//TRASHNOTES GET API
app.get("/trash", (request, response) => {
  response.sendFile("pages/trash.html", { root: __dirname });
});

//TRASHNOTES POST API
app.post("/trash", authenticateToken, async (request, response) => {
  const { userId } = request.body;
  const getTrashNotesQuery = `
            SELECT * 
            FROM trashTable 
            WHERE
                userId = ${userId};
    `;
  const allTrashNotes = await db.all(getTrashNotesQuery);
  response.send({ allTrashNotes: allTrashNotes });
});

//CLEAR TRASH API
app.delete("/trash", authenticateToken, async (request, response) => {
  const { userId } = request.body;
  const clearTrashQuery = `
        DELETE FROM trashTable WHERE userId = ${userId};
    `;
  await db.run(clearTrashQuery);
  response.send({ message: "Cleared Trash" });
});

//RESTORE NOTE API
app.post("/restoreNote", authenticateToken, async (request, response) => {
  const { noteTitle, desp, userId, trashId, deletedAt } = request.body;
  const dt = new Date();

  const date =
    dt.getFullYear() + "/" + (dt.getMonth() + 1) + "/" + dt.getDate();

  const deleteTrashQuery = `
                DELETE FROM trashTable 
                WHERE trashId = ${trashId}; 
  `;
  const addToNotesQuery = `
        INSERT INTO notesTable(noteId,noteTitle,desp,userId,createdAt)
        VALUES (${trashId},'${noteTitle}','${desp}',${userId},'${deletedAt}')
  `;
  await db.run(addToNotesQuery);
  await db.run(deleteTrashQuery);
  response.send({ message: "Note Restored" });
});

//GET ARCHIVES PAGE API
app.get("/archive", (request, response) => {
  response.sendFile("pages/archive.html", { root: __dirname });
});

//GET ALL ARCHIVES API
app.post("/archive", authenticateToken, async (request, response) => {
  const { userId } = request.body;
  const getArchiveNotesQuery = `
            SELECT * 
            FROM archiveTable 
            WHERE
                userId = ${userId};
    `;
  const allArchiveNotes = await db.all(getArchiveNotesQuery);
  response.send({ allArchiveNotes: allArchiveNotes });
});
//
//MAKE ARCHIVE PUT API
app.put("/", authenticateToken, async (request, response) => {
  const { noteTitle, desp, noteId, userId } = request.body;
  const dt = new Date();

  const date =
    dt.getFullYear() + "/" + (dt.getMonth() + 1) + "/" + dt.getDate();

  const deleteNoteQuery = `
                DELETE FROM notesTable 
                WHERE noteId = ${noteId}; 
  `;
  const deleteNoteFromRemainderQuery = `
                DELETE FROM remainderTable 
                WHERE noteId = ${noteId}; 
  `;
  const addToArchiveQuery = `
        INSERT INTO archiveTable(archiveId,noteTitle,desp,userId,createdAt)
        VALUES (${noteId},'${noteTitle}','${desp}',${userId},'${date}')
  `;
  await db.run(addToArchiveQuery);
  await db.run(deleteNoteFromRemainderQuery);
  await db.run(deleteNoteQuery);

  response.send({ message: "Note Moved To Archive" });
});

//Unarchive Note API
app.post("/unArchiveNote", authenticateToken, async (request, response) => {
  const { archiveId, userId, desp, date, noteTitle } = request.body;
  const addToNotesQuery = `
    INSERT INTO notesTable(noteId,noteTitle,desp,userId,createdAt)
    VALUES (${archiveId},'${noteTitle}','${desp}',${userId},'${date}');
  `;
  const deleteFromArchiveQuery = `
    DELETE FROM archiveTable 
    WHERE archiveId = ${archiveId};
  `;
  await db.run(addToNotesQuery);
  await db.run(deleteFromArchiveQuery);
  response.send({ message: "Note Unarchived" });
});

//REMAINDER PAGE API
app.get("/remainder", async (request, response) => {
  response.sendFile("pages/remainder.html", { root: __dirname });
});

//ADD TO REMAINDERS API
app.put("/addToRemainder", authenticateToken, async (request, response) => {
  const { noteId, userId } = request.body;
  const addToRemainderQuery = `
        INSERT INTO remainderTable(userId,noteId)
        VALUES (${userId},${noteId});
    `;
  await db.run(addToRemainderQuery);
  response.send({ message: "Note Added To Remainder" });
});

//GET ALL REMAINDER NOTES API
app.post("/remainder", authenticateToken, async (request, response) => {
  const { userId } = request.body;
  const getRemainderNoteIdQuery = `
        SELECT noteId
        FROM remainderTable
        WHERE userId = ${userId};
    `;
  let currNote = "";
  const allRemainderNoteId = await db.all(getRemainderNoteIdQuery);
  const allRemainderNotes = [];
  for (const eachNoteId of allRemainderNoteId) {
    let currNoteId = eachNoteId.noteId;
    let getCurrNoteQuery = `
        SELECT * 
        FROM notesTable
        WHERE notesTable.noteId = ${currNoteId} 
    `;
    currNote = await db.get(getCurrNoteQuery);

    allRemainderNotes.push(currNote);
  }

  response.send({ allNotes: allRemainderNotes });
});

//DELETE REMAINDER API
app.delete("/remainder", authenticateToken, async (request, response) => {
  const { userId, noteId } = request.body;
  const deleteRemainderQuery = `
        DELETE FROM remainderTable
        WHERE noteId = ${noteId};
    `;
  await db.run(deleteRemainderQuery);
  response.send({ message: "Note Deleted From Remainder" });
});

//SEARCH PAGE API
app.get("/search", (request, response) => {
  response.sendFile("pages/search.html", { root: __dirname });
});
