//frontend/src/editionAndDeletion/hooks/useLangTranslation.ts
// import {  useMemo } from "react";
import { useCallback } from "react";
import { DictionaryDataType, getLangText, LanguageKeyType, } from "../utils/languages";

// export const useLanguageTranslation = (language:LanguageKeyType)=>{
//  const translateText = useMemo(
//   ()=>(key:keyof DictionaryDataType)=> getLangText(language, key), [language]);
//   return {translateText}
//  }

export const useLanguageTranslation = (language:LanguageKeyType)=>{
const translateText = useCallback(
(keyText: keyof DictionaryDataType)=>getLangText(language, keyText)
 ,[language]
)
 return {translateText}
}




