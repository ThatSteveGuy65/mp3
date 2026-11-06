

var User = require('../models/user');
var Task = require('../models/task');
var mongoose = require('mongoose');

module.exports = function (router) {
    function checkUserId(userId) {
    if (userId === '') {
        return true;
    } else if (typeof userId !== 'string') {
        return false;
    } else {
    return /^[0-9a-fA-F]{24}$/.test(userId);
    }
    return /^[0-9a-fA-F]{24}$/.test(userId);
}


function sendSuccess(res, status, message, data) {
        return res.status(status).json({
            message: message,
            data: data
        });
    }

function sendError(res, status, message) {
        return res.status(status).json({
            message: message,
            data: null
        });
    }



    function parseJsonParam(value, name) {
    if (value === undefined) {
        return undefined;
    }

    try {
        var result = JSON.parse(value);

        if (result === null || typeof result !== 'object' || Array.isArray(result)) {
            throw new Error('Invalid ' + name + ' , Did you mispell the name ?');
        }
           return result;
        } catch (err) {
            throw new Error( name + ' parameter issuies ( 35 - 50)');
        }
    }

    // Parse skip and limit parameters
    function parseNumberParam(value, defaultValue, name) {
        if (value === undefined) {
            return defaultValue;
        }

        var number = Number(value);

        if (Number.isInteger(number) == false || number <= -1) {
            throw new Error('Invalid ' + name + ' (Interger Problem 50 - 65)');
        }

        return number;
    }

    
    router.get('/users', function (req, res) {
        try {
            var where = parseJsonParam(req.query.where, 'where') || {};
            var sort = parseJsonParam(req.query.sort, 'sort') || {};
            var select = parseJsonParam(req.query.select, 'select');
            var skip = parseNumberParam(req.query.skip, 0, 'skip');
            var limit = parseNumberParam(req.query.limit, 0, 'limit');
            var query = User.find(where);

            if (select) {
                query = query.select(select);
            }

            query = query.sort(sort).skip(skip).limit(limit);

            if (req.query.count === 'true') {
                User.countDocuments(where)
                    .then(function (count) {
                        sendSuccess(res, 200, 'User count gotten successfully', count);
                    })
                    .catch(function (err) {
                        console.error('GET users error:', err);
                        res.status(500).json({ message: err.message });
                    });
                }

            if (!(req.query.count === 'true')) {
                query.exec()
                    .then(function (users) {
                        sendSuccess(res, 200, 'gotten successfully', users);
                    })
                    .catch(function (err) {
                        console.error('GET users error:', err);
                        sendError(res, 500, 'Internal server error');
                        
                    });
            }

        } catch (err) {
            sendError(res, 400, 'Invalid request parameters');
        }
    });

//// !

    router.get('/users/:id', function (req, res) {
        try {
            var select = parseJsonParam(req.query.select, 'select') || {};

            User.findById(req.params.id)
                .select(select)
                .then(function (user) {
                    if (!user) {
                        return sendError(res, 404, 'User not found');
                    }

                    sendSuccess(res, 200, 'User retrieved successfully', user);
                })
                .catch(function (err) {
                    res.status(400).json({ message: err.message });
                });

        } catch (err) {
            sendError(res, 400, 'Invalid request parameters');
        }
    });
    
   
   router.post('/users', function (req, res) {

   //make sure name and email are there
    if (!req.body ){
        return sendError(res, 400, 'nme and email are required');
    }
    if (typeof req.body.name !== 'string'){
        return sendError(res, 400, 'nme and email are required');
    }

    if (req.body.name.trim() === ''){
        return sendError(res, 400, 'nme and email are required');
    }
    
     if (typeof req.body.email !== 'string'){
        return sendError(res, 400, 'nme and email are required');
    }
    
    if(  req.body.email.trim() === ''){

        return sendError(res, 400, 'nme and email are required');
    }

    //make the new user
    var user = new User({ name: req.body.name, email: req.body.email, pendingTasks: []
    });

    
    user.save()
        .then(function (newUser) {
            sendSuccess(res, 201, 'User created', newUser);
        })
        .catch(function (err) {


            if (err.code === 11000) {
                return sendError(res, 400, 'Email already exists');
            } else if (err.name === 'ValidationError') {
                return sendError(res, 400, 'Invalid user information');
            }

            console.error('POST user error:', err);
            sendError(res, 500, 'OTHER ERROR 150 - 170');
        });
});
    
  

    
   router.delete('/users/:id', async function (req, res) {

    // Check whether the user ID is valid
    if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
        return sendError(res, 404, 'User not found');
    }

    var session;

    try {
        session = await mongoose.startSession();
        var deletedUser;

        await session.withTransaction(async function () {

            // Find the user
            var user = await User.findById(req.params.id)
                .session(session);

            if (!user) {
                var error = new Error('User not found');
                error.status = 404;
                throw error;
            }

            // Unassign ALL tasks belonging to this user
            await Task.updateMany(
                { assignedUser: user._id.toString() },
                {
                    $set: {
                        assignedUser: '',
                        assignedUserName: 'unassigned'
                    }
                },
                { session: session }
            );

            // Delete the user
            await User.deleteOne(
                { _id: user._id },
                { session: session }
            );

            deletedUser = user;
        });

        return res.status(204).end();

    } catch (err) {

        if (err.status === 404) {
            return sendError(res, 404, 'User not found');
        }

        console.error('DELETE user error:', err);
        return sendError(res, 500, 'Internal server error');

    } finally {
        if (session) {
            await session.endSession();
        }
    }
});





router.post('/tasks', async function (req, res) {

    // Validate required fields
 if (!req.body) {
    return sendError(res, 400, 'body is missing');
 }

 if (typeof req.body.name !== 'string') {
    return sendError(res, 400, 'Name is not astring');
 }

 if (req.body.name.trim() === '') {
    return sendError(res, 400, 'Name is empty');
 }

 if (typeof req.body.deadline !== 'string') {
    return sendError(res, 400, 'Deadline is not a string');
 }

 if (req.body.deadline.trim() === '') {
    return sendError(res, 400, 'Deadline is empty');
 }

 if (isNaN(Date.parse(req.body.deadline))) {
    return sendError(res, 400, 'Deadline  valid date');
 }

    // Validate optional fields
   if (req.body.description !== undefined && typeof req.body.description !== 'string') {
    return sendError(res, 400, 'Description is not string');
      }

   if (req.body.completed !== undefined && typeof req.body.completed !== 'boolean') {
     return sendError(res, 400, 'Complete is not bool');
   }

  if (req.body.assignedUserName !== undefined && typeof req.body.assignedUserName !== 'string') {
     return sendError(res, 400, 'name must be a string');
   }

    var userId = req.body.assignedUser;

    if (userId === undefined) {
        userId = '';
    }

    if (!checkUserId(userId)) {
        return sendError(res, 400, 'Invalid assigned user ID');
    }

    var session;

    try {
        session = await mongoose.startSession();

        var newTask;

        await session.withTransaction(async function () {

            var user = null;

            if (userId !== '') {
                user = await User.findById(userId).session(session);

                if (!user) {
                    var error = new Error('Assigned user not found');
                    error.status = 404;
                    throw error;
                }
            }

            var userName = user ? user.name : 'unassigned';

            // Reject an inconsistent assignedUserName
            if (req.body.assignedUserName !== undefined &&
                req.body.assignedUserName !== userName) {

                var nameError = new Error('Assigned user name does not match');
                nameError.status = 400;
                throw nameError;
            }

            var task = new Task({
                name: req.body.name,
                description: req.body.description,
                deadline: req.body.deadline,
                completed: req.body.completed,
                assignedUser: userId,
                assignedUserName: userName
            });

            await task.save({ session: session });

            // Only incomplete tasks belong in pendingTasks
            if (user && !task.completed) {
                await User.updateOne(
                    { _id: user._id },
                    { $addToSet: { pendingTasks: task._id.toString() } },
                    { session: session }
                );
            }

            newTask = task;
        });

        return sendSuccess(res, 201, 'Task created successfully', newTask);

    } catch (err) {

        if (err.status === 400 || err.status === 404) {
            return sendError(res, err.status, err.message);
        }

        if (err.name === 'ValidationError' ||
            err.name === 'CastError') {
            return sendError(res, 400, 'Invalid task information');
        }

        console.error('POST task error:', err);
        return sendError(res, 500, 'Internal server error');

    } finally {
        if (session) {
            await session.endSession();
        }
    }
});


    router.get('/tasks', function (req, res) {
        try {
            var where = parseJsonParam(req.query.where, 'where') || {};
            var sort = parseJsonParam(req.query.sort, 'sort') || {};
            var select = parseJsonParam(req.query.select, 'select');

            var skip = parseNumberParam(req.query.skip, 0, 'skip');
            var limit = parseNumberParam(req.query.limit, 100, 'limit');

            var query = Task.find(where);

            if (select) {
                query = query.select(select);
            }

            query = query.sort(sort).skip(skip).limit(limit);

          if (req.query.count === 'true') {
            return Task.countDocuments(where)
         .then(function (count) {
            sendSuccess(res, 200, 'Task count retrieved successfully', count);
            })
            .catch(function (err) {
                res.status(500).json({ message: err.message });
            });
            }

        query.exec()
             .then(function (tasks) {
                    sendSuccess(res, 200, 'Tasks retrieved successfully', tasks);
            })
            .catch(function (err) {
                sendError(res, 500, 'Internal server error');
            });

            } catch (err) {
                 sendError(res, 400, 'Invalid request parameters');
        }
    });









    router.get('/tasks/:id', function (req, res) {
        try {
            var select = parseJsonParam(req.query.select, 'select') || {};

            Task.findById(req.params.id)
                .select(select)
                .then(function (task) {
            if (!task) {
                        return sendError(res, 404, 'Task not found');
                    }

                    sendSuccess(res, 200, 'Task was successful', task);
                })
                .catch(function (err) {
                    res.status(400).json({ message: err.message });
                });

        } catch (err) {
            res.status(400).json({ message: err.message });
        }
    });




router.put('/tasks/:id', async function (req, res) {

    // 1. Validate the task ID
    if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
        return sendError(res, 404, 'Task not found');
    }

    var session;

    try {
        session = await mongoose.startSession();
        var updatedTask;

        await session.withTransaction(async function () {

            // 2. Find the existing task
            var task = await Task.findById(req.params.id).session(session);

            if (!task) {
                var notFound = new Error('Task not found');
                notFound.status = 404;
                throw notFound;
            }

            // 3. Validate required fields
            if (!req.body ||
                typeof req.body.name !== 'string' ||
                req.body.name.trim() === '' ||
                typeof req.body.deadline !== 'string' ||
                req.body.deadline.trim() === '' ||
                isNaN(Date.parse(req.body.deadline))) {

                var invalid = new Error('Valid name and deadline are required');
                invalid.status = 400;
                throw invalid;
            }

            // 4. Validate optional fields
           if (req.body.description !== undefined && typeof req.body.description !== 'string') {
            var invalidFields = new Error('Invalid task information');
            invalidFields.status = 400;
                    throw invalidFields;
            }

            if (req.body.completed !== undefined && typeof req.body.completed !== 'boolean') {
                var invalidFields = new Error('Invalid task information');
                invalidFields.status = 400;
                throw invalidFields;
            }

                if (req.body.assignedUserName !== undefined && typeof req.body.assignedUserName !== 'string') {
                    var invalidFields = new Error('Invalid task information');
                    invalidFields.status = 400;
                    throw invalidFields;
                }

            // 5. Determine the assigned user
            var userId = req.body.assignedUser;

            if (userId === undefined) {
                userId = task.assignedUser;
            }

            if (!checkUserId(userId)) {
                var invalidUserId = new Error('Invalid assigned user ID');
                invalidUserId.status = 400;
                throw invalidUserId;
            }

            var user = null;

            if (userId !== '') {
                user = await User.findById(userId).session(session);

                if (!user) {
                    var missingUser = new Error('Assigned user not found');
                    missingUser.status = 404;
                    throw missingUser;
                }
            }

            var userName = user ? user.name : 'unassigned';

            // 6. Validate assignedUserName
            if (req.body.assignedUserName !== undefined &&
                req.body.assignedUserName !== userName) {

                var invalidName = new Error('Assigned user name does not match');
                invalidName.status = 400;
                throw invalidName;
            }

            // 7. Remove task from previous user's pendingTasks
            if (task.assignedUser !== '') {
                await User.updateOne(
                    { _id: task.assignedUser },
                    { $pull: { pendingTasks: task._id.toString() } },
                    { session: session }
                );
            }

            // 8. Update task fields
            const {name, description = '',deadline,completed = false } = req.body;

                        task.name = name;
                        task.description = description;
                        task.deadline = deadline;
                        task.completed = completed;
                        task.assignedUser = userId;
                        task.assignedUserName = userName;

                        await task.save({ session });

            // 9. Add incomplete task to assigned user's pendingTasks
            if (user && !task.completed) {
                await User.updateOne(
                    { _id: user._id },
                    { $addToSet: { pendingTasks: task._id.toString() } },
                    { session: session }
                );
            }

            updatedTask = task;
        });

        return sendSuccess(
            res,
            200,
            'Task updated successfully',
            updatedTask
        );

    } catch (err) {

        if (err.status === 400 || err.status === 404) {
            return sendError(res, err.status, err.message);
        }

        if (err.name === 'ValidationError' ||
            err.name === 'CastError') {
            return sendError(res, 400, 'Invalid task information');
        }

        console.error('PUT task error:', err);
        return sendError(res, 500, 'Internal server error');

    } finally {
        if (session) {
            await session.endSession();
        }
    }
});

  
   
    
router.put('/users/:id', async function (req, res) {

    // 1. Check the user ID first
    if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
        return sendError(res, 404, 'User not found');
    }

    var session;

    try {
        session = await mongoose.startSession();
        var updatedUser;

        await session.withTransaction(async function () {

            // 2. Find the user
            var user = await User.findById(req.params.id).session(session);

            if (!user) {
                var error = new Error('User not found');
                error.status = 404;
                throw error;
            }

            
            if (!req.body) {
    var invalid = new Error('Valid name and email are required');
    invalid.status = 400;
    throw invalid;
}

                if (typeof req.body.name !== 'string') {
                    var invalid = new Error('Valid name and email are required 11');
                    invalid.status = 400;
                    throw invalid;
                }

                if (req.body.name.trim() === '') {
                    var invalid = new Error('Valid name and email are required 2');
                    invalid.status = 400;
                    throw invalid;
                }

                if (typeof req.body.email !== 'string') {
                    var invalid = new Error('Valid name and email are required 3');
                    invalid.status = 400;
                    throw invalid;
                }

                if (req.body.email.trim() === '') {
                    var invalid = new Error('Valid name and email are required 4');
                    invalid.status = 400;
                    throw invalid;
                }

            
            var pendingTasks = req.body.pendingTasks;

            if (pendingTasks === undefined) {
                pendingTasks = [];
            }

            if (!Array.isArray(pendingTasks)) {
                var invalidArray = new Error('pendingTasks must be an array');
                invalidArray.status = 400;
                throw invalidArray;
            }

            // 5. Validate task IDs
            var taskIds = [];

            for (var i = 0; i < pendingTasks.length; i++) {

                var taskId = pendingTasks[i];

                if (typeof taskId !== 'string' ||
                    !/^[0-9a-fA-F]{24}$/.test(taskId)) {

                    var invalidId = new Error('Invalid task ID');
                    invalidId.status = 400;
                    throw invalidId;
                }

                taskId = taskId.toLowerCase();

                if (taskIds.indexOf(taskId) !== -1) {
                    var duplicate = new Error('Duplicate task ID');
                    duplicate.status = 400;
                    throw duplicate;
                }

                taskIds.push(taskId);
            }

            // 6. Find and validate all requested tasks
            var tasks = await Task.find({
                _id: { $in: taskIds }
            }).session(session);

            if (tasks.length !== taskIds.length) {
                var missingTask = new Error('Task not found');
                missingTask.status = 404;
                throw missingTask;
            }

            for (var j = 0; j < tasks.length; j++) {
                if (tasks[j].completed) {
                    var completedError = new Error(
                        'Completed tasks cannot be pending'
                    );
                    completedError.status = 400;
                    throw completedError;
                }
            }

            // 7. Unassign tasks removed from pendingTasks
            await Task.updateMany(
                {
                    assignedUser: user._id.toString(),
                    completed: false,
                    _id: { $nin: taskIds }
                },
                {
                    $set: {
                        assignedUser: '',
                        assignedUserName: 'unassigned'
                    }
                },
                { session: session }
            );

            
            for (var k = 0; k < tasks.length; k++) {

                var task = tasks[k];

                if (task.assignedUser !== '' &&
                    task.assignedUser !== user._id.toString()) {

                    await User.updateOne(
                        { _id: task.assignedUser },
                        {
                            $pull: {
                                pendingTasks: task._id.toString()
                            }
                        },
                        { session: session }
                    );
                }
            }

            
            await Task.updateMany(
                { _id: { $in: taskIds } },
                {
                    $set: {
                        assignedUser: user._id.toString(),
                        assignedUserName: req.body.name.trim()
                    }
                },
                { session: session }
            );

            
            await Task.updateMany(
                { assignedUser: user._id.toString() },
                {
                    $set: {
                        assignedUserName: req.body.name.trim()
                    }
                },
                { session: session }
            );

            // 11. Update the user
            user.name = req.body.name;
            user.email = req.body.email;
            user.pendingTasks = taskIds;

            await user.save({ session: session });

            updatedUser = user;
        });

        return sendSuccess(
            res,
            200,
            'User updated successfully',
            updatedUser
        );

    } catch (err) {

        if (err.status === 400 || err.status === 404) {
            return sendError(res, err.status, err.message);
        }

        if (err.code === 11000) {
            return sendError(res, 400, 'Email already exists');
        }

        if (err.name === 'ValidationError' ||
            err.name === 'CastError') {
            return sendError(res, 400, 'Invalid user information');
        }

        console.error('PUT user error:', err);
        return sendError(res, 500, 'Internal server error');

    } finally {
        if (session) {
            await session.endSession();
        }
    }
});










    // DELETE /api/tasks/:id
    // Delete a task
    
router.delete('/tasks/:id', async function (req, res) {

    // Check the task ID format
    if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
        return sendError(res, 404, 'Task not found');
    }


    var session;

    try {
        session = await mongoose.startSession();
        var deletedTask;

        await session.withTransaction(async function () {

            // Find the task
            var task = await Task.findById(req.params.id)
                .session(session);

            if (!task) {
                var error = new Error('Task not found');
                error.status = 404;
                throw error;
            }

            
            if (task.assignedUser !== '') {
                await User.updateOne(
                    { _id: task.assignedUser },
                    {
                        $pull: {
                            pendingTasks: task._id.toString()
                        }
                    },
                    { session: session }
                );
            }

            // Delete the task
            await Task.deleteOne(
                { _id: task._id },
                { session: session }
            );

            deletedTask = task;
        });

        return res.status(204).end();

    } catch (err) {

        if (err.status === 404) {
            return sendError(res, 404, 'Task not found');
        }

        console.error('DELETE task error:', err);
        return sendError(res, 500, 'Internal server error');

    } finally {
        if (session) {
            await session.endSession();
        }
    }
});


    return router;
};