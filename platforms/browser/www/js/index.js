/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
var app = {
    // Application Constructor
    initialize: function() {
        document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);
    },

    // deviceready Event Handler
    //
    // Bind any cordova events here. Common events are:
    // 'pause', 'resume', etc.
    onDeviceReady: function() {
        this.receivedEvent('deviceready');
    },

    // Update DOM on a Received Event
    receivedEvent: function(id) {
    	main();
    }
};

app.initialize();
//app.onDeviceReady();

function main() {
	const swiper = document.getElementById('swiper');
	swiper.style.width = `${document.documentElement.clientWidth}px`;
	swiper.style.height = `${document.documentElement.clientHeight}px`;

	//Объект хранения состояния загрузки на текущий момент
	const state = {

		//Идет ли загрузка данных в данный момент времени
		isLoading: false,

		//Поле для фиксирования получения/неполучения данных по какой-либо причине
		contentAvailable: true,
		
		//Должны ли элементы получаться с сервера на рандоме
		isRandom: false,

		//Исполнители, число подписчиков которых не превышает данное поле
		maxCountOFSubs: 100000
	}

	//Функция контроля над массивом данных
	let getNextContent = controlContent([]);


	//Классы для обработки ошибок, связанных с сервером
	class NoDataError extends Error {
		constructor(message) {
			super(message);
			this.name = this.constructor.name;
		}
	}
	class NoServerConnectionError extends Error {
		constructor(message) {
			super(message);
			this.name = this.constructor.name;
		}
	}


	//Объект для работы с элементами(в HTML) свайпера
	const workWithBlocks = {

		createBlockWithContent: function(content) {
			const block = document.createElement('div');
			block.className = 'swiper_item';
			block.innerHTML = 
			`
				<div class="block">
					<div class="wrapper">
						<div class="name">
							${content.name}
						</div>
						 <!-- <img data-src = ${content.photo} alt = ""> -->
						<div class="subs">
							Подписчиков: <span>${content.username}</span>
						</div>
						<div class="description">
							Описание: <span>${content.email}</span>
						</div>
					</div>
				</div>
			`;
			giveShapeOfSwiperFrameToBlock(block);
			//lazyLoad(block.querySelector('img'));
			return block;

			//Функция постепенной прогрузки изображений
			function lazyLoad(img) {
				img.setAttribute('src', img.getAttribute('data-src'));
				img.onload = function() {
					img.removeAttribute('data-src');
				}
			}

			//Задание размеров создаваемому блоку
			function giveShapeOfSwiperFrameToBlock(block) {
				block.style.width = `${swiper.clientWidth}px`;
				block.style.height = `${swiper.clientHeight}px`;
			}
		},

		createLoadBlock: function() {
			const block = document.createElement('div');
			block.className = 'loading_page';
			block.innerHTML = 
			`
				<div class="lds-roller"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>
			`;
			block.style.width = `${swiper.clientWidth}px`;
			block.style.height = `${swiper.clientHeight}px`;
			return block;
		},

		createErrorServerBlock: function() {
			const block = document.createElement('div');
			block.className = 'block_error';
			block.innerHTML = 
			`
				<div class = wrapper_error>
					<p>Больше ничего не найдено</p>
					<button id = 'recall'><span class="icon-spinner11"></span></button>
				</div>

			`;
			block.style.width = `${swiper.clientWidth}px`;
			block.style.height = `${swiper.clientHeight}px`;
			return block;
		},

		createBlockWithoutContent: function() {
			const block = document.createElement('div');
			block.className = 'block_nothing';
			block.innerHTML = 
			`
				<div class = wrapper_nothing>
					<p>Больше нет результатов</p>
				</div>

			`;
			block.style.width = `${swiper.clientWidth}px`;
			block.style.height = `${swiper.clientHeight}px`;
			return block;
		},
		
		createFormBlock: function() {
			const block = document.createElement('div');
			block.className = 'form_input';
			block.innerHTML = 
			`
				<form id = "account" name = "account">
					<h2>Войдите в свой аккаунт</h2>
					<input type="text" placeholder = "Логин" id = "login" name = "login"/>
					<input type="text" placeholder = "Пароль" id = "pass" name = "pass"/>
					<input type="button" value = "Войти" id = "enter_to_acc" name = "enter_acc"/>
				</form>

			`;
			block.style.width = `${swiper.clientWidth}px`;
			block.style.height = `${swiper.clientHeight}px`;
			return block;
		},


		//Инициализация впередистоящего элемента и добавление
		//(используется при прогрузке следующего массива, чтобы построить первый элемент)
		buildTheFrontBlock: function(content) {
			if(content) {
				const buildedBlock = this.createBlockWithContent(content);
				buildedBlock.classList.add('front');
				swiper.append(buildedBlock);		
				buildedBlock.addEventListener('touchstart', eventSwipe);
			}
		},

		//Построение следующего блока. Идет постепенная подгрузка следующего контента
		buildTheNextBlock: function(content) {
			if(content) {
				const buildedBlock = this.createBlockWithContent(content);
				buildedBlock.classList.add('next');
				swiper.append(buildedBlock);		
			}
		},

		//Удаление старого начального блока, его замена с next, построение нового next
		rebuildBlocks: function(content) {
			const deletedElement = document.querySelector('.front');
			deletedElement.removeEventListener('touchstart', eventSwipe);

			//Ожидание улета пролистанного блока за границы экрана, последующее перестроение
			setTimeout(() => {
				deletedElement.remove();
				deletedElement.classList.remove('front');

				const nextElement = document.querySelector('.next');
				if(nextElement) {
					nextElement.classList.add('front');
					nextElement.classList.remove('next');
					nextElement.addEventListener('touchstart', eventSwipe);
				} else {
					document.getElementById('mix').style.zIndex = '0';
				}

				this.buildTheNextBlock(content); 
			}, 300);
		}
	}



	swiper.append(workWithBlocks.createLoadBlock());
	swiper.append(workWithBlocks.createErrorServerBlock());
	swiper.append(workWithBlocks.createBlockWithoutContent());
	swiper.append(workWithBlocks.createFormBlock());



	//Функция для хранения характеристик массива и для его псевдоинкапуляции. Забирается контент ИЗ КОНЦА
	//для увеличения скорости на стороне клиента (предполагается изначальная сортировка на стороне сервера)
	function controlContent(arrayOfContent) {

		//Остаток контента (для регуляции подгрузки)
		getContent.balanceOfContent = arrayOfContent.length;
		getContent.allContent = arrayOfContent;

		function getContent(){
			getContent.balanceOfContent--;
			return arrayOfContent.pop();
		}

		return getContent;
	}

	//Подзагрузка нового контента с сервера
	function loadContentFromServer(url, concat = true) {

		//Возвращение в стандартное состояние перед загрузкой
		state.isLoading = true;
		state.contentAvailable = true;
		document.querySelector('.block_nothing').style.zIndex = '20';
		document.querySelector('.block_error').style.zIndex = '10';
		controlMixBut();

		fetch(url)
			.then(response => {
				if(response.ok)
					return response.json();
				else
					throw new NoServerConnectionError('No server connection');
			})
			.then(json => {
				//Если получен пустой массив => больше данных нет, необходимо вывести блок с информацией об этом
				if(json.length === 0) 
					throw new NoDataError('No data');
				//Добавление новых данных к уже существующим
				if(concat)
					getNextContent = controlContent(json.concat(getNextContent.allContent));
				else
					getNextContent = controlContent(json);
				//Проверка на отрисованность элементов свайпера при загрузке
				//В случае отсутствия какого-либо блока они прорисовываются
				if(!document.querySelector('.front')) {
					console.log('front');
					workWithBlocks.buildTheFrontBlock(getNextContent());
				}			
				if(!document.querySelector('.next')) {
					console.log('next');
					workWithBlocks.buildTheNextBlock(getNextContent());
				}
			})
			.catch((e) => {
				state.contentAvailable = false;
				if(e.name === 'NoServerConnectionError')
					document.querySelector('.block_error').style.zIndex = '40';
				else if(e.name === 'NoDataError')
					document.querySelector('.block_nothing').style.zIndex = '40';
				else 
					throw e;
			})
			.finally(() => {
				state.isLoading = false;
				controlMixBut();
			});
	}

	function controlMixBut() {
		if(document.querySelector('.front'))
			document.getElementById('mix').style.zIndex = '130';
		else
			document.getElementById('mix').style.zIndex = '0';
	}

	//callback, передаваемый слушателю события пролистывания свайпера
	function eventSwipe(event) {

		const targetOfEvent = event.target.closest('.front');

		targetOfEvent.style.transition = 'none';

		//Координаты начального клика относительно верхнего левого угла блока свайпера
		const startXClick = event.changedTouches[0].clientX - swiper.getBoundingClientRect().left;
		const startYClick = event.changedTouches[0].clientY - swiper.getBoundingClientRect().top;

		//Координаты начального клика относительно окна
		const startXClient = event.changedTouches[0].clientX;
		const startYClient = event.changedTouches[0].clientY;

		//Определение, где был совершен клик, чтобы двигать элемент в той же его точке
		const biasX = event.changedTouches[0].clientX - swiper.getBoundingClientRect().left;
		const biasY = event.changedTouches[0].clientY - swiper.getBoundingClientRect().top;

		//Если курсор выше половины высоты => поворот против часовой (и наоборот)
		const sign = startYClient >= swiper.getBoundingClientRect().top + swiper.offsetHeight/2 ? 1 : -1;

		swiper.addEventListener('touchmove', mouseMove);

		function mouseMove(event) {

			//Новые координаты относительно блока свайпера
			const actualCoordX = event.changedTouches[0].clientX - swiper.getBoundingClientRect().left - biasX;
			const actualCoordY = event.changedTouches[0].clientY - swiper.getBoundingClientRect().top - biasY;

			//Рассчет поворота угла, исходя из разницы в координатах X
			const rotate = sign*(startXClient - event.changedTouches[0].clientX)*0.15;

			targetOfEvent.style.transform = `rotate(${rotate}deg)`;

			//Перемещение элемента в указанные координаты
			targetOfEvent.style.left =  `${actualCoordX}px`;
			targetOfEvent.style.top =  `${actualCoordY}px`;

			event.preventDefault();
		}

		swiper.addEventListener('touchend', resultOfSwipe);

		//Если курсор ушел со слайдера, то считается, что пользователь отпустил мышь и совершаем аналогичное
		//поднятию курсора действие
		swiper.addEventListener('touchcancel', resultOfSwipe);

		//Функция обработки результата свайпа
		function resultOfSwipe(event) {

			//Пролистывание блока, если произошло смещение на определенный порог, иначе возращение в исходное состояние
			if(Math.abs(event.changedTouches[0].clientX - startXClient) >= swiper.offsetWidth*0.4){

				//Определение в какую сторону должен улететь блок
				const scroll = event.changedTouches[0].clientX - startXClient <= 0 ? -swiper.offsetWidth*2 : swiper.offsetWidth*3;

				//Плавное перемещение блока за границы экрана
				targetOfEvent.style.transition = '0.4s';
				targetOfEvent.style.left = `${scroll}px`;

				changeBlocks();
			}
			else {
				bringItemToStart();
			}

			//Чистка событий
			swiper.removeEventListener('touchmove', mouseMove);
			swiper.addEventListener('touchend', resultOfSwipe);
			swiper.addEventListener('touchcancel', resultOfSwipe);
		}

		//Плавное возвращение элемента в исходное состояние (если свайп не произошел)
		function bringItemToStart() {
			targetOfEvent.style.transition = '0.6s';
			targetOfEvent.style.transform = 'none';
			targetOfEvent.style.left = '0';
			targetOfEvent.style.top = '0';
		}

		//Подгрузка новых блоков при смене элемента
		function changeBlocks() {
			if(getNextContent.balanceOfContent <= 3 && !state.isLoading && state.contentAvailable){
				//loadContentFromServer(`https://jsonplaceholder.typicode.com/users?isRandom=${state.isRandom}&maxCountOFSubs=${state.maxCountOFSubs}`);
				loadContentFromServer('https://jsonplaceholder.typicode.com/users');
			}
			workWithBlocks.rebuildBlocks(getNextContent());
			controlMixBut();
		}
	}

	document.getElementById('recall').addEventListener('click', () => {
		//loadContentFromServer(`https://jsonplaceholder.typicode.com/users?isRandom=${state.isRandom}&maxCountOFSubs=${state.maxCountOFSubs}`);
		loadContentFromServer('https://jsonplaceholder.typicode.com/users');
	});

	document.getElementById('enter_to_acc').addEventListener('click', () => {
		let formAcc = document.forms.account;
		//loadContentFromServer(`https://jsonplaceholder.typicode.com/users?login=${formAcc.login.value}&pass=${formAcc.pass.value}&isRandom=${state.isRandom}&maxCountOFSubs=${state.maxCountOFSubs}`);
		loadContentFromServer(`https://jsonplaceholder.typicode.com/users`);
		document.querySelector('.form_input').style.zIndex = '0';
	});


	document.getElementById('mix').addEventListener('click', () => {
		document.getElementById('mix').classList.toggle('not_mixed');
		state.isRandom = !state.isRandom;
		//loadContentFromServer(`https://jsonplaceholder.typicode.com/users?&isRandom=${state.isRandom}&maxCountOFSubs=${state.maxCountOFSubs}`, false);
		loadContentFromServer(`https://jsonplaceholder.typicode.com/users`, false);
	});
}