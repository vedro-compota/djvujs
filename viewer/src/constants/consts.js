const Consts = {
    ARRAY_BUFFER_LOADED_ACTION: null,
    IMAGE_DATA_RECIEVED_ACTION: null,
    DOCUMENT_CREATED_ACTION: null,
    SET_NEW_PAGE_NUMBER_ACTION: null,
    DATA_URL_CREATED_ACTION: null,
    TOGGLE_FULL_PAGE_VIEW_ACTION: null,
    SET_USER_SCALE_ACTION: null
};

for (const key in Consts) {
    if (Consts[key] === null) {
        Consts[key] = key;
    }
}

export default Consts;