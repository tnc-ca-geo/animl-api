export default `
  type UpdateLabelsPayload {
    images: [Image]
  }`;

// TODO: consider just returning a status (success/fail) as we don't
// do anything w/ the updated image on the front end;
// we update the images' labels in state separately before this call returns
