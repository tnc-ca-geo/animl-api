// TODO: fetch config

// TODO: prompt user - Importing data will overwrite existing data and cannot be undone. Create a backup before importing?
  // if yes, export backup

// TODO: prompt user for path to json backups folder,
  // validate w/ fs.existsSync and check that there are .json files in it

// TODO: prompt user - import multiple collections or single collection? 

// TODO: if single collection, prompt user for name of collection

// TODO: prompt user for mode? upsert v/ insert?

// TODO: prompt user - last warning. Continue Y/N?

// TODO: Iterate through collections to import and execute the following:
  // mongoimport --uri mongodb+srv://animlDB:<PASSWORD>@cluster0.bqyly.mongodb.net/<DATABASE> --collection <COL> --type json --file <FILE> --mode=upsert