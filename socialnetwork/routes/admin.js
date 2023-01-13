const {ObjectId} = require("mongodb");

module.exports = function (app, usersRepository, friendsRepository, publicationsRepository, messagesRepository) {
    let logger = app.get('logger');
    /**
     * It was decided that it was more suitable to create a specific .js file for admin functionalities, due to the
     * ease that it provides when checking if the right user is accessing these pages (it has to be the admin user)
     * and in order not to pollute the code of the user routes (/user/...-)
     *
     * It works with the request and returns the view with all the users as the response
     */
    app.get('/admin/list', function (req, res) {
        logger.info("[GET] /admin/list");

        usersRepository.getUsersAdmin({}, {}).then(users => {
            res.render('admin/users.twig', {users: users, sessionUser: req.session.user});
        }).catch(error => {
            res.send("Se ha producido un error al listar los usuarios: " + error)
        })
    });

    app.post('/admin/delete', function (req, res) {
        logger.info("[POST] /admin/delete");
        for (var key in req.body) {
            if (req.body.hasOwnProperty(key)) {
                item = req.body[key];

                if (item[0].length == 1) {
                    let filter = {_id: ObjectId(item)};
                    usersRepository.findUser(filter, {}).then( user => {

                        if(user==null) {
                            console.log("admin::delete found a null user!");
                            return;
                        }

                        let filterRequests = {
                            $or:[
                                {sender: user.email},
                                {receiver: user.email}
                            ],
                        }
                        friendsRepository.deleteFriendsOfUser(filterRequests, {});
                        let filterPublications = {
                            $or:[
                                {author: user.email},
                            ]
                        }
                        publicationsRepository.deletePublicationsOfUser(filterPublications, {});
                        let filterMessages = {
                            $or:[
                                {sender: user.email},
                                {receiver: user.email}
                            ]
                        }
                        messagesRepository.deleteMessagesOfUser(filterMessages, {});
                    }).then(
                    usersRepository.deleteUser(filter, {}).then(result => {
                        if (result == null || result.deletedCount == 0) {
                            res.send("No se ha podido eliminar el usuario");
                        } else {
                            res.redirect("/admin/list");
                        }
                    }).catch(error => {
                        res.send("Se ha producido un error al intentar eliminar el usuario: " + error)
                    })
                );

                } else {

                    let deletedIds = [];
                    for (let i = 0; i < item.length; i++) {
                            deletedIds.push(ObjectId(item[i]))
                    }
                    let filter = {_id: {$in: deletedIds}};
                    let options = { projection: { email : 1}}
                    usersRepository.findUsers(filter, options).then( emails => {

                    console.log(emails);

                    deleteUsersData(emails).then(usersRepository.deleteUsers(filter, {}).then(result => {
                            if (result == null || result.deletedCount == 0) {
                                res.send("No se ha podido eliminar el usuario");
                            } else {
                                res.redirect("/admin/list");
                            }
                        }).catch(error => {
                            res.send("Se ha producido un error al intentar eliminar el usuario: " + error)
                        })
                    );

                    })
                }
            }
        }
    });

    async function deleteUsersData(emails) {

        let emailsArray = [];
        for (let i = 0; i < emails.length; i++) {
            emailsArray.push(emails[i].email);
        }

        let filterRequests = {
            $or: [
                {sender: {$in: emailsArray}},
                {receiver: {$in: emailsArray}}
            ]
        }
        await friendsRepository.deleteFriendsOfUser(filterRequests, {});

        let filterPublications = {author: {$in: emailsArray}};

        await publicationsRepository.deletePublicationsOfUser(filterPublications, {});

        let filterMessages = {
            $or: [
                {sender: {$in: emailsArray}},
                {receiver: {$in: emailsArray}}
            ]
        }
        await messagesRepository.deleteMessagesOfUser(filterMessages, {});

    }


    app.get('/admin/duplicate/:id', function (req, res) {
        logger.info("[GET] /admin/duplicate");

        let filter = {_id: ObjectId(req.params.id)};
        usersRepository.findUser(filter, {}).then(user => {
            console.log(user)
            res.render("admin/duplicate.twig", {user: user});
        })

    })

    app.post('/admin/duplicate/:id', function (req, res) {
        logger.info("[POST] /admin/duplicate/"+req.params.id);

        let id = req.params.id;

        let securePassword = app.get("crypto").createHmac('sha256', app.get('clave'))
            .update(req.body.password).digest('hex');

        let userValidate = {
            email: req.body.email,
            name: req.body.name,
            surname: req.body.surname,
            password: req.body.password,
            passwordConfirm : req.body.passwordConfirm
        };

        validateDuplicate(userValidate, function(errors){
            if (errors!=null && errors.length>0){
                logger.error("[POST] /admin/duplicate - " + errors);
                res.redirect("/admin/duplicate/" + id +
                    "?message="+errors+"&messageType=alert-danger");
            } else {
                let user = {
                    email: req.body.email,
                    name: req.body.name,
                    surname: req.body.surname,
                    password: securePassword,
                    role:"standard"
                };

                usersRepository.getUsers({email: req.body.email}, {}).then( users => {
                    if (users != null && users.length != 0){
                        logger.error("[POST] /admin/duplicate/ - Email is already in use");
                        res.redirect("/admin/duplicate/" + id +
                            "?message=Email is already in use"+
                            "&messageType=alert-danger");
                    } else {
                        usersRepository.insertUser(user).then(userId => {
                            //todo Redirigir a las opciones de usuario
                            res.redirect("/admin/list" + "?message=New user successfully registered" +
                                "&messageType=alert-success");
                        }).catch(error => {
                            logger.error("[POST] /admin/duplicate - An error has occurred adding the user");
                            res.redirect("/admin/duplicate" +
                                "?message=An error has occurred adding the user"+
                                "&messageType=alert-danger");
                        });
                    }
                }).catch(error => {
                    logger.error("[POST] /admin/duplicate - An error has occurred");
                    res.redirect("/admin/duplicate" + id +
                        "?message=An error has occurred"+
                        "&messageType=alert-danger");
                });

            }
        })




    });


    function validateDuplicate(user, callback){
        let errors = new Array();
        //Name
        if (user.name === null || typeof user.name === 'undefined' ||user.name.length<4 ||user.name.length>20|| user.name.trim().length == 0){
            errors.push("Name must be between 4 and 20 characters, it cannot be empty");
        }

        //Surname
        if (user.surname === null || typeof user.surname === 'undefined' ||user.surname.length<4 ||user.surname.length>20|| user.surname.trim().length == 0){
            errors.push("Surname must be between 4 and 20 characters. It cannot be empty");
        }

        //Email
        if (user.email === null || typeof user.email === 'undefined' || user.email.trim().length == 0){
            errors.push("Email cannot be empty");
        }
        //testing the email has the correct format
        let pattern = /\S+@\S+\.\S+/;
        if (! pattern.test(user.email)){
            errors.push("Email does not follow the expected format");
        }

        //Password
        if (user.password !== user.passwordConfirm){
            errors.push("Passwords do not match");
        }
        if (user.password === null || typeof user.password === 'undefined' ||user.password.length<5 ||user.password.length>8|| user.password.trim().length == 0){
            errors.push("Password must be between 5 and 8 characters");
        }


        if (errors.length<=0){
            callback(null);
        } else {
            callback(errors);
        }
    }


}