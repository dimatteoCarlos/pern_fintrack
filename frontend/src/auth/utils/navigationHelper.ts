// src/utils/navigationHelper.ts
import { NavigateFunction, NavigateOptions, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

// 🚨 GLOBAL VARIABLE 🚨
//Global variable to store navigate function
let navigateRef : NavigateFunction| null = null;

//Hook to set navigate function at starting the application (Call from App.tsx)
export const useNavigationHelper=()=>{
  const navigateTo=useNavigate();
  //store navigate function once
  useEffect(()=>{
    navigateRef=navigateTo;
    return ()=>{
    navigateRef=null;
    }
  }, [navigateTo])
}

//Navigation function to use it anywhere
export const navigationHelper = {
/**
   * 🚨 navigate() wrapper to allow navigation outside React components.
   * @param path Target URL
   * @param options Optional: React Router NavigateOptions (like { state: { expired: true } })
   */
 navigate:(path:string, options?:NavigateOptions)=>{
  if(navigateRef){
    navigateRef(path, options);//internal navigate function
  }else{
    const errorMessage='Falling back to window.location, since, Navigation helper not initialized';
    console.error(errorMessage);
    // returns a Location object with information about the current location of the document
    window.location.replace(path);
    }
  }
}
//-------------------------------------------
//Singleton pattern
