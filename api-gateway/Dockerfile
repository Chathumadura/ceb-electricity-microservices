FROM nginx:alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY swagger /usr/share/nginx/html/swagger
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]