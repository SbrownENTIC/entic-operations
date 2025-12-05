import React, { createContext, useContext, useState } from 'react';

const FormContext = createContext({
  isDirty: false,
  setIsDirty: () => {},
});

export const useFormState = () => useContext(FormContext);

export const FormProvider = ({ children }) => {
  const [isDirty, setIsDirty] = useState(false);
  
  return (
    <FormContext.Provider value={{ isDirty, setIsDirty }}>
      {children}
    </FormContext.Provider>
  );
};