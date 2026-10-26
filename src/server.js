const app=require('./app'); const migrate=require('./migrate'); const port=Number(process.env.PORT||3000); migrate(); app.listen(port,'0.0.0.0',()=>console.log(`Nexora Pay écoute sur ${port}`));
