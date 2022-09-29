function GetCustom(){
    let idInput = document.querySelector("#customID") as HTMLInputElement;
    let id:number = Math.abs(Number(idInput.value));

    fetch(`/api/v1/custom/${id}`)
        .then(value => value.json())
        .then(text => console.log(text))
        .catch(reason => console.error(reason));
}